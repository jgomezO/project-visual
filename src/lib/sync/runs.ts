import "server-only";
import { getServerSupabaseAdmin } from "@/lib/supabase/service";

export interface OpenRunArgs {
  syncType: "full" | "incremental";
  projectKey: string | null;
}

export interface RunStats {
  issuesCreated: number;
  issuesUpdated: number;
  issuesDeleted?: number;
  linksSkipped: number;
}

export async function openRun(args: OpenRunArgs): Promise<number> {
  const supabase = getServerSupabaseAdmin();
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({
      status: "running",
      sync_type: args.syncType,
      project_key: args.projectKey,
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

export async function failRun(
  id: number,
  errorMessage: string,
  jqlUsed: string | null,
): Promise<void> {
  const supabase = getServerSupabaseAdmin();
  const { error } = await supabase
    .from("sync_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error_message: errorMessage.slice(0, 5000),
      jql_used: jqlUsed,
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
