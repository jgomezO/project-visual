import "server-only";
import { JiraClient } from "@/lib/jira/client";
import { syncProjects } from "./projects";
import { syncIssuesForProject } from "./issues";
import {
  failRun,
  openRun,
  partialRun,
  succeedRun,
  type FailedProject,
  type RunStats,
} from "./runs";

export interface RunSyncArgs {
  type?: "full" | "incremental";
  projectKey?: string | null;
  // iter 6: distinguishes manual UI / curl invocations from automated
  // Vercel Cron runs. Defaults to 'manual' so existing call sites that
  // don't set it record the truth (manual). The cron route handler
  // explicitly passes 'cron'.
  triggeredBy?: "manual" | "cron";
}

export interface RunSyncResult {
  syncRunId: number;
  status: "success" | "partial" | "failed";
  syncType: "full" | "incremental";
  triggeredBy: "manual" | "cron";
  projectKey: string | null;
  jqlUsed: string | null;
  // Aggregated stats — reflect ONLY the projects that synced cleanly.
  // Failed projects don't count their partial writes here even when
  // they may have written some rows before throwing.
  issuesCreated: number;
  issuesUpdated: number;
  linksSkipped: number;
  // iter 9a: tombstone reconciliation totals. Only non-zero for runs
  // that include at least one full per-project sync (incrementals
  // can't observe absence, so they contribute 0).
  issuesMarkedDeleted: number;
  issuesRestoredFromDeleted: number;
  // iter 6: per-project resilience surface.
  // success = count of projects that synced cleanly within this run.
  // failed = per-project errors; empty array on clean success.
  success: number;
  failed: FailedProject[];
  totalDurationMs: number;
  // Top-level message — set when status === 'failed' (no project synced
  // OR pre-loop abort). For 'partial', omitted (per-project detail
  // already lives in `failed`).
  errorMessage?: string;
}

// Supabase's PostgrestError is a plain object (not an Error instance), so a
// naive String(e) yields "[object Object]". Extract a readable message.
function describeError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.length > 0) {
      const code = typeof obj.code === "string" ? ` (${obj.code})` : "";
      const details =
        typeof obj.details === "string" && obj.details.length > 0
          ? ` — ${obj.details}`
          : "";
      const hint =
        typeof obj.hint === "string" && obj.hint.length > 0
          ? ` [hint: ${obj.hint}]`
          : "";
      return `${obj.message}${code}${details}${hint}`;
    }
    try {
      return JSON.stringify(e);
    } catch {
      return String(e);
    }
  }
  return String(e);
}

export async function runSync(args: RunSyncArgs = {}): Promise<RunSyncResult> {
  const startedAt = Date.now();
  const declaredType: "full" | "incremental" = args.type ?? "incremental";
  const projectKeyFilter = args.projectKey ?? null;
  const triggeredBy: "manual" | "cron" = args.triggeredBy ?? "manual";

  const runId = await openRun({
    syncType: declaredType,
    projectKey: projectKeyFilter,
    triggeredBy,
  });

  let lastJql: string | null = null;
  let resolvedSyncType: "full" | "incremental" = declaredType;
  const stats: RunStats = {
    issuesCreated: 0,
    issuesUpdated: 0,
    issuesDeleted: 0,
    linksSkipped: 0,
  };
  let issuesRestoredFromDeleted = 0;
  const failedProjects: FailedProject[] = [];
  let successCount = 0;

  try {
    const jira = new JiraClient();

    const { projectKeys: allKeys } = await syncProjects(jira);

    const keysToSync = projectKeyFilter
      ? allKeys.filter((k) => k === projectKeyFilter)
      : allKeys;

    if (projectKeyFilter && keysToSync.length === 0) {
      throw new Error(
        `Project "${projectKeyFilter}" was not returned by listProjects(). ` +
          `Check JIRA_PROJECT_KEYS or that the API token has access to it.`,
      );
    }

    console.log(
      `[sync] runId=${runId} triggeredBy=${triggeredBy} type=${declaredType} ` +
        `projects=${keysToSync.length}${projectKeyFilter ? ` filter=${projectKeyFilter}` : ""}`,
    );

    // iter 6: per-project resilience. Wrap each syncIssuesForProject
    // in its own try/catch so one project's failure doesn't abort the
    // entire run. Stats accumulate only on success; failures land in
    // failedProjects with the project key + error message.
    for (const key of keysToSync) {
      console.log(`[sync] runId=${runId} project=${key} starting`);
      try {
        const result = await syncIssuesForProject(jira, key, {
          full: declaredType === "full",
        });
        stats.issuesCreated += result.issuesCreated;
        stats.issuesUpdated += result.issuesUpdated;
        stats.issuesDeleted =
          (stats.issuesDeleted ?? 0) + result.issuesMarkedDeleted;
        issuesRestoredFromDeleted += result.issuesRestoredFromDeleted;
        stats.linksSkipped += result.linksSkipped;
        lastJql = result.jql;
        resolvedSyncType = result.syncType;
        successCount += 1;
        // iter 9a: deletion telemetry only meaningful on full syncs.
        // Suffix only renders when something actually changed so
        // incremental log lines stay tidy.
        const deletedSuffix =
          result.issuesMarkedDeleted > 0 ||
          result.issuesRestoredFromDeleted > 0
            ? ` markedDeleted=${result.issuesMarkedDeleted}` +
              ` restoredFromDeleted=${result.issuesRestoredFromDeleted}`
            : "";
        console.log(
          `[sync] runId=${runId} project=${key} ok ` +
            `created=${result.issuesCreated} updated=${result.issuesUpdated}` +
            deletedSuffix,
        );
      } catch (e) {
        const message = describeError(e);
        failedProjects.push({ projectKey: key, error: message });
        console.error(
          `[sync] runId=${runId} project=${key} failed error="${message}"`,
        );
        // Continue with the next project.
      }
    }

    const totalDurationMs = Date.now() - startedAt;

    // Decide aggregate status from the per-project results.
    if (failedProjects.length === 0) {
      // Clean run — every project succeeded (or there were zero to do).
      await succeedRun(runId, stats, lastJql);
      const deletedSuffix =
        (stats.issuesDeleted ?? 0) > 0 || issuesRestoredFromDeleted > 0
          ? ` markedDeleted=${stats.issuesDeleted ?? 0}` +
            ` restoredFromDeleted=${issuesRestoredFromDeleted}`
          : "";
      console.log(
        `[sync] runId=${runId} done status=success success=${successCount} ` +
          `failed=0 durationMs=${totalDurationMs}` +
          deletedSuffix,
      );
      return {
        syncRunId: runId,
        status: "success",
        syncType: resolvedSyncType,
        triggeredBy,
        projectKey: projectKeyFilter,
        jqlUsed: lastJql,
        issuesCreated: stats.issuesCreated,
        issuesUpdated: stats.issuesUpdated,
        linksSkipped: stats.linksSkipped,
        issuesMarkedDeleted: stats.issuesDeleted ?? 0,
        issuesRestoredFromDeleted,
        success: successCount,
        failed: failedProjects,
        totalDurationMs,
      };
    }

    if (successCount === 0) {
      // Every attempted project failed. Pre-loop work (syncProjects)
      // succeeded so we did make it INTO the loop — but no progress
      // was made, so the run is 'failed'.
      const summary =
        `All ${failedProjects.length} project${failedProjects.length === 1 ? "" : "s"} failed: ` +
        failedProjects.map((f) => f.projectKey).join(", ");
      await failRun(runId, summary, lastJql, failedProjects);
      console.log(
        `[sync] runId=${runId} done status=failed success=0 ` +
          `failed=${failedProjects.length} durationMs=${totalDurationMs}`,
      );
      return {
        syncRunId: runId,
        status: "failed",
        syncType: resolvedSyncType,
        triggeredBy,
        projectKey: projectKeyFilter,
        jqlUsed: lastJql,
        issuesCreated: stats.issuesCreated,
        issuesUpdated: stats.issuesUpdated,
        linksSkipped: stats.linksSkipped,
        issuesMarkedDeleted: stats.issuesDeleted ?? 0,
        issuesRestoredFromDeleted,
        success: 0,
        failed: failedProjects,
        totalDurationMs,
        errorMessage: summary,
      };
    }

    // Mixed: at least one success and at least one failure → partial.
    await partialRun(runId, stats, lastJql, failedProjects);
    const deletedSuffix =
      (stats.issuesDeleted ?? 0) > 0 || issuesRestoredFromDeleted > 0
        ? ` markedDeleted=${stats.issuesDeleted ?? 0}` +
          ` restoredFromDeleted=${issuesRestoredFromDeleted}`
        : "";
    console.log(
      `[sync] runId=${runId} done status=partial success=${successCount} ` +
        `failed=${failedProjects.length} durationMs=${totalDurationMs}` +
        deletedSuffix,
    );
    return {
      syncRunId: runId,
      status: "partial",
      syncType: resolvedSyncType,
      triggeredBy,
      projectKey: projectKeyFilter,
      jqlUsed: lastJql,
      issuesCreated: stats.issuesCreated,
      issuesUpdated: stats.issuesUpdated,
      linksSkipped: stats.linksSkipped,
      issuesMarkedDeleted: stats.issuesDeleted ?? 0,
      issuesRestoredFromDeleted,
      success: successCount,
      failed: failedProjects,
      totalDurationMs,
    };
  } catch (e) {
    // Top-level abort: pre-loop failure (JiraClient ctor, syncProjects,
    // listProjects, projectKeyFilter not found, etc.). The run never
    // entered the per-project loop, so failedProjects is empty.
    const message = describeError(e);
    await failRun(runId, message, lastJql, null);
    const totalDurationMs = Date.now() - startedAt;
    console.error(
      `[sync] runId=${runId} top-level failure error="${message}" ` +
        `durationMs=${totalDurationMs}`,
    );
    return {
      syncRunId: runId,
      status: "failed",
      syncType: resolvedSyncType,
      triggeredBy,
      projectKey: projectKeyFilter,
      jqlUsed: lastJql,
      issuesCreated: stats.issuesCreated,
      issuesUpdated: stats.issuesUpdated,
      linksSkipped: stats.linksSkipped,
      issuesMarkedDeleted: stats.issuesDeleted ?? 0,
      issuesRestoredFromDeleted,
      success: successCount,
      failed: failedProjects,
      totalDurationMs,
      errorMessage: message,
    };
  }
}
