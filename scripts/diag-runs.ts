// Dev tool — diagnose recent sync_runs + cleanup stuck "running" rows.
// Usage:
//   node --env-file=.env.local --import tsx scripts/diag-runs.ts          # report only
//   node --env-file=.env.local --import tsx scripts/diag-runs.ts --reap   # report + mark stale running rows as failed

import { createClient } from "@supabase/supabase-js";

const STALE_RUN_THRESHOLD_MIN = 5;

async function main() {
  const reap = process.argv.includes("--reap");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  if (reap) {
    const cutoff = new Date(
      Date.now() - STALE_RUN_THRESHOLD_MIN * 60 * 1000,
    ).toISOString();
    const { data: reaped, error } = await supabase
      .from("sync_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: `Reaped: stuck in 'running' for >${STALE_RUN_THRESHOLD_MIN}min (likely killed by HMR / process restart).`,
      })
      .eq("status", "running")
      .lt("started_at", cutoff)
      .select("id");
    if (error) {
      console.error("Reap failed:", error);
      process.exit(1);
    }
    console.log(
      `Reaped ${reaped?.length ?? 0} stale running run(s):`,
      (reaped ?? []).map((r) => `#${r.id}`).join(", ") || "(none)",
    );
    console.log("");
  }

  const { data: runs } = await supabase
    .from("sync_runs")
    .select(
      "id, status, sync_type, project_key, started_at, finished_at, issues_created, issues_updated, links_skipped, error_message, jql_used",
    )
    .order("started_at", { ascending: false })
    .limit(15);
  console.log("Recent sync_runs:");
  for (const r of runs ?? []) {
    const startMs = new Date(r.started_at).getTime();
    const endMs = r.finished_at ? new Date(r.finished_at).getTime() : Date.now();
    const dur = Math.round((endMs - startMs) / 1000) + "s";
    const startedAtStr = new Date(r.started_at).toISOString().slice(11, 19);
    console.log(
      `  #${String(r.id).padStart(3)} ${r.status.padEnd(8)} ${(r.sync_type ?? "?").padEnd(12)} ${(r.project_key ?? "all").padEnd(10)} start=${startedAtStr} dur=${dur.padEnd(8)} +${r.issues_created}/${r.issues_updated}  ${r.error_message ? "ERR: " + r.error_message.slice(0, 200) : ""}`,
    );
  }

  console.log("\nProjects + issue + link counts:");
  const { data: projects } = await supabase
    .from("projects")
    .select("id, key, name, last_synced_at")
    .order("key");
  for (const p of projects ?? []) {
    const { count } = await supabase
      .from("issues")
      .select("*", { count: "exact", head: true })
      .eq("project_id", p.id);
    const { data: ids } = await supabase
      .from("issues")
      .select("id")
      .eq("project_id", p.id);
    const issueIdSet = new Set((ids ?? []).map((r) => r.id));
    let linkCount = 0;
    if (issueIdSet.size > 0) {
      const { data: links } = await supabase
        .from("issue_links")
        .select("source_issue_id")
        .in("source_issue_id", Array.from(issueIdSet));
      linkCount = links?.length ?? 0;
    }
    const lastSync = p.last_synced_at
      ? new Date(p.last_synced_at).toISOString().slice(0, 19) + "Z"
      : "never";
    console.log(
      `  ${p.key.padEnd(12)} ${String(count ?? 0).padStart(6)} issues  ${String(linkCount).padStart(6)} links   last sync: ${lastSync}`,
    );
  }

  const { count: nullLinkCount } = await supabase
    .from("issue_links")
    .select("*", { count: "exact", head: true })
    .is("target_issue_id", null);
  console.log(`\nissue_links rows with target_issue_id NULL: ${nullLinkCount}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
