import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runSync } from "./index";
import { failRun, openRun, partialRun, succeedRun } from "./runs";
import { syncProjects } from "./projects";
import { syncIssuesForProject } from "./issues";

// Strategy: mock the helper modules (./runs, ./projects, ./issues) and
// JiraClient at the import boundary. runSync's job is the
// success/partial/failed decision tree — the helpers are tested
// elsewhere (or aren't, for the inner sync logic; out of iter 8 scope).
//
// vi.mock is hoisted by Vitest so the imports above resolve to the
// mocked versions. JiraClient is mocked as an empty constructor —
// runSync never accesses methods on `new JiraClient()` because the
// helpers that DO use it (syncProjects, syncIssuesForProject) are
// also mocked.
vi.mock("@/lib/jira/client", () => ({ JiraClient: vi.fn() }));
vi.mock("./runs");
vi.mock("./projects");
vi.mock("./issues");

// Canned successful result that syncIssuesForProject returns by default.
// Tests override per-call via mockResolvedValueOnce / mockRejectedValueOnce.
const successResult = {
  syncType: "incremental" as const,
  jql: 'project = "X"',
  issuesCreated: 5,
  issuesUpdated: 2,
  linksSkipped: 1,
  // iter 9a: incremental syncs always report 0 for both deletion fields
  // (detection only runs on full syncs).
  issuesMarkedDeleted: 0,
  issuesRestoredFromDeleted: 0,
};

beforeEach(() => {
  // Re-arm defaults per test. mockReset clears both call history and
  // any prior mockResolvedValueOnce queue, so tests are isolated.
  vi.mocked(openRun).mockReset().mockResolvedValue(42);
  vi.mocked(succeedRun).mockReset().mockResolvedValue();
  vi.mocked(partialRun).mockReset().mockResolvedValue();
  vi.mocked(failRun).mockReset().mockResolvedValue();
  vi.mocked(syncProjects)
    .mockReset()
    .mockResolvedValue({ projectKeys: ["A", "B", "C"] });
  vi.mocked(syncIssuesForProject).mockReset().mockResolvedValue(successResult);

  // Silence runSync's structured logging — they're greppability for
  // Vercel logs in production, but pollute test output here.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runSync — aggregate status decision (iter 6 contract)", () => {
  it("all projects succeed → status='success', succeedRun called once", async () => {
    const result = await runSync();

    expect(result.status).toBe("success");
    expect(result.success).toBe(3);
    expect(result.failed).toEqual([]);
    expect(result.errorMessage).toBeUndefined();

    expect(succeedRun).toHaveBeenCalledOnce();
    expect(partialRun).not.toHaveBeenCalled();
    expect(failRun).not.toHaveBeenCalled();
  });

  it("some succeed and some fail → status='partial', partialRun called with failed_projects", async () => {
    vi.mocked(syncIssuesForProject)
      .mockResolvedValueOnce(successResult) // A ok
      .mockRejectedValueOnce(new Error("Jira down for B")) // B fails
      .mockResolvedValueOnce(successResult); // C ok

    const result = await runSync();

    expect(result.status).toBe("partial");
    expect(result.success).toBe(2);
    expect(result.failed).toEqual([
      { projectKey: "B", error: "Jira down for B" },
    ]);

    expect(partialRun).toHaveBeenCalledOnce();
    // partialRun signature: (id, stats, jqlUsed, failedProjects)
    const partialArgs = vi.mocked(partialRun).mock.calls[0];
    expect(partialArgs[3]).toEqual([
      { projectKey: "B", error: "Jira down for B" },
    ]);

    expect(succeedRun).not.toHaveBeenCalled();
    expect(failRun).not.toHaveBeenCalled();
  });

  it("all projects fail → status='failed', failRun called with full failed_projects", async () => {
    vi.mocked(syncIssuesForProject)
      .mockRejectedValueOnce(new Error("err A"))
      .mockRejectedValueOnce(new Error("err B"))
      .mockRejectedValueOnce(new Error("err C"));

    const result = await runSync();

    expect(result.status).toBe("failed");
    expect(result.success).toBe(0);
    expect(result.failed).toHaveLength(3);
    expect(result.errorMessage).toContain("All 3 projects failed");
    // Summary message lists every failed key.
    expect(result.errorMessage).toMatch(/A.*B.*C/);

    expect(failRun).toHaveBeenCalledOnce();
    // failRun signature: (id, errorMessage, jqlUsed, failedProjects)
    const failArgs = vi.mocked(failRun).mock.calls[0];
    expect(failArgs[3]).toHaveLength(3);

    expect(succeedRun).not.toHaveBeenCalled();
    expect(partialRun).not.toHaveBeenCalled();
  });

  it("pre-loop abort (syncProjects throws) → status='failed', failed_projects passed as NULL", async () => {
    vi.mocked(syncProjects).mockRejectedValue(
      new Error("listProjects auth failure"),
    );

    const result = await runSync();

    expect(result.status).toBe("failed");
    expect(result.success).toBe(0);
    expect(result.failed).toEqual([]);
    expect(result.errorMessage).toContain("listProjects auth failure");

    expect(failRun).toHaveBeenCalledOnce();
    // The pre-loop abort path passes failed_projects=null because the
    // loop never ran — there are no per-project errors to attribute.
    const failArgs = vi.mocked(failRun).mock.calls[0];
    expect(failArgs[3]).toBeNull();

    // The per-project loop never executed.
    expect(syncIssuesForProject).not.toHaveBeenCalled();
  });

  it("projectKey filter narrows keysToSync — only the matched key reaches syncIssuesForProject", async () => {
    const result = await runSync({ projectKey: "B" });

    expect(result.status).toBe("success");
    expect(syncIssuesForProject).toHaveBeenCalledTimes(1);
    // syncIssuesForProject signature: (jira, key, opts)
    expect(vi.mocked(syncIssuesForProject).mock.calls[0][1]).toBe("B");
  });

  it("projectKey filter that matches no project → status='failed' (top-level abort)", async () => {
    const result = await runSync({ projectKey: "Z" });

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain('"Z"');
    // The mismatch is detected before the loop, so syncIssuesForProject
    // never runs and failed_projects stays empty.
    expect(syncIssuesForProject).not.toHaveBeenCalled();
    expect(result.failed).toEqual([]);
  });

  it("aggregated stats reflect ONLY successful projects (failed projects' stats discarded)", async () => {
    vi.mocked(syncIssuesForProject)
      .mockResolvedValueOnce({ ...successResult, issuesCreated: 10 })
      .mockRejectedValueOnce(new Error("B failed"))
      .mockResolvedValueOnce({ ...successResult, issuesCreated: 5 });

    const result = await runSync();

    expect(result.status).toBe("partial");
    // 10 (A) + 5 (C). B's hypothetical writes don't count even if the
    // helper internally upserted some rows before throwing — runSync
    // only credits stats from successful returns.
    expect(result.issuesCreated).toBe(15);
  });

  it("openRun receives triggeredBy='manual' by default and 'cron' when explicitly passed", async () => {
    await runSync();
    expect(vi.mocked(openRun).mock.calls[0][0]).toMatchObject({
      triggeredBy: "manual",
    });

    vi.mocked(openRun).mockClear();
    await runSync({ triggeredBy: "cron" });
    expect(vi.mocked(openRun).mock.calls[0][0]).toMatchObject({
      triggeredBy: "cron",
    });
  });
});
