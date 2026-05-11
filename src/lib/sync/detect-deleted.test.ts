import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { detectDeletedIssues } from "./detect-deleted";
import type { Database } from "@/lib/supabase/types";

// Iter 9a — soft-delete reconciliation contract.
//
// Strategy: hand-rolled in-memory fake of the supabase-js fluent builder
// covering only the calls `detectDeletedIssues` makes. Two reasons over
// `vi.mock`:
//   1. The function takes its supabase client by parameter, so injection
//      is the testability story already designed in.
//   2. The two write batches (mark + restore) need to be observable
//      individually — a `Map`-backed store lets us assert which ids
//      ended up tombstoned vs which got NULL'd.

interface IssueRow {
  id: string;
  key: string;
  deleted_at: string | null;
  project_id: string;
}

interface UpdateCall {
  ids: string[];
  deletedAt: string | null;
}

function createFakeSupabase(initialIssues: IssueRow[]) {
  const store = new Map<string, IssueRow>(initialIssues.map((r) => [r.id, r]));
  const updateCalls: UpdateCall[] = [];

  const client = {
    from: (table: string) => {
      if (table !== "issues") {
        throw new Error(`unexpected table: ${table}`);
      }
      return {
        // The production helper passes "id, key, deleted_at" as the
        // column list; we ignore it because the in-memory store has
        // every field on every row.
        select: () => ({
          eq: (col: string, value: string) => {
            if (col !== "project_id") {
              throw new Error(`unexpected select.eq column: ${col}`);
            }
            const data = Array.from(store.values()).filter(
              (r) => r.project_id === value,
            );
            // `.eq()` chain ends in a thenable; supabase-js returns
            // `{ data, error }`. Mirror it exactly.
            return Promise.resolve({ data, error: null });
          },
        }),
        update: (patch: { deleted_at: string | null }) => ({
          in: (col: string, ids: string[]) => {
            if (col !== "id") {
              throw new Error(`unexpected update.in column: ${col}`);
            }
            updateCalls.push({ ids: [...ids], deletedAt: patch.deleted_at });
            for (const id of ids) {
              const row = store.get(id);
              if (row) row.deleted_at = patch.deleted_at;
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      };
    },
    _store: store,
    _updateCalls: updateCalls,
  };

  return client;
}

// Helper: cast the fake into the type the production helper expects.
// Tests can't see beyond the methods used in detectDeletedIssues, so the
// cast is sound for this surface.
function asSupabase(fake: ReturnType<typeof createFakeSupabase>) {
  return fake as unknown as SupabaseClient<Database>;
}

describe("detectDeletedIssues", () => {
  it("empty DB + empty freshKeys → no-op, both counters at 0", async () => {
    const fake = createFakeSupabase([]);

    const result = await detectDeletedIssues("p1", [], asSupabase(fake));

    expect(result).toEqual({ markedDeleted: 0, restoredFromDeleted: 0 });
    expect(fake._updateCalls).toEqual([]);
  });

  it("steady state — every DB key is in freshKeys and none deleted → no-op", async () => {
    const fake = createFakeSupabase([
      { id: "i1", key: "PRJ-1", deleted_at: null, project_id: "p1" },
      { id: "i2", key: "PRJ-2", deleted_at: null, project_id: "p1" },
      { id: "i3", key: "PRJ-3", deleted_at: null, project_id: "p1" },
    ]);

    const result = await detectDeletedIssues(
      "p1",
      ["PRJ-1", "PRJ-2", "PRJ-3"],
      asSupabase(fake),
    );

    expect(result).toEqual({ markedDeleted: 0, restoredFromDeleted: 0 });
    expect(fake._updateCalls).toEqual([]);
  });

  it("DB key missing from freshKeys gets deleted_at = NOW(), others untouched", async () => {
    const fake = createFakeSupabase([
      { id: "i1", key: "PRJ-1", deleted_at: null, project_id: "p1" },
      { id: "i2", key: "PRJ-2", deleted_at: null, project_id: "p1" },
      { id: "i3", key: "PRJ-3", deleted_at: null, project_id: "p1" },
    ]);

    const result = await detectDeletedIssues(
      "p1",
      ["PRJ-1", "PRJ-3"],
      asSupabase(fake),
    );

    expect(result).toEqual({ markedDeleted: 1, restoredFromDeleted: 0 });
    expect(fake._updateCalls).toHaveLength(1);
    const call = fake._updateCalls[0]!;
    expect(call.ids).toEqual(["i2"]);
    expect(call.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
    // Other rows stayed NULL.
    expect(fake._store.get("i1")!.deleted_at).toBeNull();
    expect(fake._store.get("i3")!.deleted_at).toBeNull();
  });

  it("previously-tombstoned key reappears in freshKeys → restored to NULL", async () => {
    const fake = createFakeSupabase([
      {
        id: "i1",
        key: "PRJ-1",
        deleted_at: "2026-05-01T00:00:00.000Z",
        project_id: "p1",
      },
      { id: "i2", key: "PRJ-2", deleted_at: null, project_id: "p1" },
    ]);

    const result = await detectDeletedIssues(
      "p1",
      ["PRJ-1", "PRJ-2"],
      asSupabase(fake),
    );

    expect(result).toEqual({ markedDeleted: 0, restoredFromDeleted: 1 });
    expect(fake._updateCalls).toHaveLength(1);
    const call = fake._updateCalls[0]!;
    expect(call.ids).toEqual(["i1"]);
    expect(call.deletedAt).toBeNull();
    expect(fake._store.get("i1")!.deleted_at).toBeNull();
  });

  it("mixed — one mark + one restore in the same call → two separate UPDATE batches", async () => {
    const fake = createFakeSupabase([
      // Was deleted, now reappears.
      {
        id: "i1",
        key: "PRJ-1",
        deleted_at: "2026-05-01T00:00:00.000Z",
        project_id: "p1",
      },
      // Active, will be marked deleted (missing from freshKeys).
      { id: "i2", key: "PRJ-2", deleted_at: null, project_id: "p1" },
      // Active, stays active.
      { id: "i3", key: "PRJ-3", deleted_at: null, project_id: "p1" },
    ]);

    const result = await detectDeletedIssues(
      "p1",
      ["PRJ-1", "PRJ-3"],
      asSupabase(fake),
    );

    expect(result).toEqual({ markedDeleted: 1, restoredFromDeleted: 1 });
    expect(fake._updateCalls).toHaveLength(2);
    // Order matters: mark first (writes NOW()), then restore (writes NULL).
    // Asserting as a multiset because the helper's internal ordering is
    // an implementation detail — what matters is that both happened.
    const marks = fake._updateCalls.filter((c) => c.deletedAt !== null);
    const restores = fake._updateCalls.filter((c) => c.deletedAt === null);
    expect(marks).toHaveLength(1);
    expect(marks[0]!.ids).toEqual(["i2"]);
    expect(restores).toHaveLength(1);
    expect(restores[0]!.ids).toEqual(["i1"]);
  });

  it("already-tombstoned key still missing from freshKeys → no-op (don't re-mark)", async () => {
    const fake = createFakeSupabase([
      {
        id: "i1",
        key: "PRJ-1",
        deleted_at: "2026-05-01T00:00:00.000Z",
        project_id: "p1",
      },
      { id: "i2", key: "PRJ-2", deleted_at: null, project_id: "p1" },
    ]);

    const result = await detectDeletedIssues(
      "p1",
      ["PRJ-2"],
      asSupabase(fake),
    );

    // i1 was already tombstoned and is still missing — leave it alone.
    // i2 is active and still in freshKeys — leave it alone.
    expect(result).toEqual({ markedDeleted: 0, restoredFromDeleted: 0 });
    expect(fake._updateCalls).toEqual([]);
    // Original timestamp preserved (didn't touch the row).
    expect(fake._store.get("i1")!.deleted_at).toBe(
      "2026-05-01T00:00:00.000Z",
    );
  });

  it("scoped by project_id — issues from other projects are not considered", async () => {
    const fake = createFakeSupabase([
      // Project under test:
      { id: "i1", key: "PRJ-1", deleted_at: null, project_id: "p1" },
      { id: "i2", key: "PRJ-2", deleted_at: null, project_id: "p1" },
      // Different project — should be invisible to this run.
      { id: "i9", key: "OTHER-1", deleted_at: null, project_id: "p2" },
    ]);

    const result = await detectDeletedIssues(
      "p1",
      ["PRJ-1", "PRJ-2"],
      asSupabase(fake),
    );

    expect(result).toEqual({ markedDeleted: 0, restoredFromDeleted: 0 });
    expect(fake._updateCalls).toEqual([]);
    // Cross-project row stays NULL even though "OTHER-1" is not in
    // freshKeys — the helper never even saw it.
    expect(fake._store.get("i9")!.deleted_at).toBeNull();
  });

  it("freshKeys empty but DB has issues → marks every active row in the project", async () => {
    // Edge case: a project whose Jira issues were all genuinely deleted,
    // OR a board that legitimately holds zero issues now. The contract
    // says trust the fetch — both rows get tombstoned. Self-healing on
    // the next sync covers the bad-data variant.
    const fake = createFakeSupabase([
      { id: "i1", key: "PRJ-1", deleted_at: null, project_id: "p1" },
      { id: "i2", key: "PRJ-2", deleted_at: null, project_id: "p1" },
    ]);

    const result = await detectDeletedIssues("p1", [], asSupabase(fake));

    expect(result).toEqual({ markedDeleted: 2, restoredFromDeleted: 0 });
    expect(fake._updateCalls).toHaveLength(1);
    expect(fake._updateCalls[0]!.ids.sort()).toEqual(["i1", "i2"]);
  });
});
