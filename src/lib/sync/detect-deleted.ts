import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface DetectDeletedResult {
  markedDeleted: number;
  restoredFromDeleted: number;
}

/**
 * Reconcile soft-delete state for a project by comparing fresh Jira keys
 * against what the DB currently holds. Caller MUST only invoke this after
 * a successful FULL sync of `projectId` — incremental syncs return only
 * issues updated since the watermark, so a non-fresh key during an
 * incremental run does NOT mean the issue was deleted upstream.
 *
 * Two write batches happen here:
 *   1. issues that exist in DB, are NOT in `freshKeys`, and are NOT yet
 *      tombstoned → set `deleted_at = NOW()`.
 *   2. issues that exist in DB, ARE in `freshKeys`, and ARE currently
 *      tombstoned → set `deleted_at = NULL` (auto-restore).
 *
 * No threshold / no rollback — the contract is that bad-data windows
 * (truncated Jira fetch the operator didn't notice, etc.) self-heal on
 * the next successful full sync. The caller's try/catch in `runSync` is
 * the only safety net: a thrown error here propagates to the per-project
 * resilience layer and the run lands in `partial` / `failed` state.
 */
export async function detectDeletedIssues(
  projectId: string,
  freshKeys: string[],
  supabase: SupabaseClient<Database>,
): Promise<DetectDeletedResult> {
  const { data: dbIssues, error } = await supabase
    .from("issues")
    .select("id, key, deleted_at")
    .eq("project_id", projectId);
  if (error) throw error;

  const freshSet = new Set(freshKeys);
  const toMarkDeleted: string[] = [];
  const toRestore: string[] = [];

  for (const row of dbIssues ?? []) {
    const isFresh = freshSet.has(row.key);
    const wasDeleted = row.deleted_at !== null;

    if (!isFresh && !wasDeleted) {
      toMarkDeleted.push(row.id);
    } else if (isFresh && wasDeleted) {
      toRestore.push(row.id);
    }
  }

  const now = new Date().toISOString();

  if (toMarkDeleted.length > 0) {
    const { error: markErr } = await supabase
      .from("issues")
      .update({ deleted_at: now })
      .in("id", toMarkDeleted);
    if (markErr) throw markErr;
  }

  if (toRestore.length > 0) {
    const { error: restoreErr } = await supabase
      .from("issues")
      .update({ deleted_at: null })
      .in("id", toRestore);
    if (restoreErr) throw restoreErr;
  }

  return {
    markedDeleted: toMarkDeleted.length,
    restoredFromDeleted: toRestore.length,
  };
}
