import "server-only";
import { getServerSupabaseAdmin } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";

export interface OpenRunArgs {
  syncType: "full" | "incremental";
  projectKey: string | null;
  // iter 6: distinguishes manual UI / curl invocations from automated
  // Vercel Cron runs. Persisted on every sync_run row so post-deploy
  // observability can split "scheduled health" from "PM clicked refresh".
  triggeredBy: "manual" | "cron";
}

export interface RunStats {
  issuesCreated: number;
  issuesUpdated: number;
  issuesDeleted?: number;
  linksSkipped: number;
}

// One entry per project that failed within a run. Stored as JSONB on
// sync_runs.failed_projects so the dashboard's status badge can read
// the full detail in a single row fetch (no per-project sub-rows).
export interface FailedProject {
  projectKey: string;
  error: string;
}

export async function openRun(args: OpenRunArgs): Promise<number> {
  const supabase = getServerSupabaseAdmin();
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      status: "running",
      sync_type: args.syncType,
      project_key: args.projectKey,
      triggered_by: args.triggeredBy,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw error ?? new Error("Failed to open sync_run row");
  }
  return data.id;
}

export async function succeedRun(
  id: number,
  stats: RunStats,
  jqlUsed: string | null,
): Promise<void> {
  const supabase = getServerSupabaseAdmin();
  const { error } = await supabase
    .from("sync_runs")
    .update({
      status: "success",
      finished_at: new Date().toISOString(),
      issues_created: stats.issuesCreated,
      issues_updated: stats.issuesUpdated,
      issues_deleted: stats.issuesDeleted ?? 0,
      links_skipped: stats.linksSkipped,
      jql_used: jqlUsed,
    })
    .eq("id", id);
  if (error) throw error;
}

// iter 6: per-project resilience. Some projects synced successfully,
// some failed. Aggregate stats reflect only the successful ones;
// failed_projects carries per-project errors for debugging + the UI
// badge. error_message gets a summary line ("N projects failed: X, Y").
export async function partialRun(
  id: number,
  stats: RunStats,
  jqlUsed: string | null,
  failedProjects: FailedProject[],
): Promise<void> {
  const supabase = getServerSupabaseAdmin();
  const summaryMessage =
    `${failedProjects.length} project${failedProjects.length === 1 ? "" : "s"} failed: ` +
    failedProjects.map((f) => f.projectKey).join(", ");
  const { error } = await supabase
    .from("sync_runs")
    .update({
      status: "partial",
      finished_at: new Date().toISOString(),
      issues_created: stats.issuesCreated,
      issues_updated: stats.issuesUpdated,
      issues_deleted: stats.issuesDeleted ?? 0,
      links_skipped: stats.linksSkipped,
      jql_used: jqlUsed,
      error_message: summaryMessage.slice(0, 5000),
      failed_projects: failedProjects as unknown as Json,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function failRun(
  id: number,
  errorMessage: string,
  jqlUsed: string | null,
  failedProjects: FailedProject[] | null = null,
): Promise<void> {
  const supabase = getServerSupabaseAdmin();
  const { error } = await supabase
    .from("sync_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: errorMessage.slice(0, 5000),
      jql_used: jqlUsed,
      failed_projects: failedProjects as unknown as Json | null,
    })
    .eq("id", id);
  if (error) {
    // Already in a failure path; surface the secondary error to logs but
    // don't shadow the original sync error to the caller.
    console.error(
      `[sync] failed to mark sync_run ${id} as failed:`,
      error.message,
    );
  }
}
