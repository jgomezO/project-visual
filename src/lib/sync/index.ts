import "server-only";
import { JiraClient } from "@/lib/jira/client";
import { syncProjects } from "./projects";
import { syncIssuesForProject } from "./issues";
import { failRun, openRun, succeedRun, type RunStats } from "./runs";

export interface RunSyncArgs {
  type?: "full" | "incremental";
  projectKey?: string | null;
}

export interface RunSyncResult {
  syncRunId: number;
  status: "success" | "failed";
  syncType: "full" | "incremental";
  projectKey: string | null;
  jqlUsed: string | null;
  issuesCreated: number;
  issuesUpdated: number;
  linksSkipped: number;
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
  const declaredType: "full" | "incremental" = args.type ?? "incremental";
  const projectKeyFilter = args.projectKey ?? null;

  const runId = await openRun({
    syncType: declaredType,
    projectKey: projectKeyFilter,
  });

  let lastJql: string | null = null;
  let resolvedSyncType: "full" | "incremental" = declaredType;
  const stats: RunStats = {
    issuesCreated: 0,
    issuesUpdated: 0,
    linksSkipped: 0,
  };

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

    for (const key of keysToSync) {
      const result = await syncIssuesForProject(jira, key, {
        full: declaredType === "full",
      });
      stats.issuesCreated += result.issuesCreated;
      stats.issuesUpdated += result.issuesUpdated;
      stats.linksSkipped += result.linksSkipped;
      lastJql = result.jql;
      resolvedSyncType = result.syncType;
    }

    await succeedRun(runId, stats, lastJql);

    return {
      syncRunId: runId,
      status: "success",
      syncType: resolvedSyncType,
      projectKey: projectKeyFilter,
      jqlUsed: lastJql,
      issuesCreated: stats.issuesCreated,
      issuesUpdated: stats.issuesUpdated,
      linksSkipped: stats.linksSkipped,
    };
  } catch (e) {
    const message = describeError(e);
    await failRun(runId, message, lastJql);
    return {
      syncRunId: runId,
      status: "failed",
      syncType: resolvedSyncType,
      projectKey: projectKeyFilter,
      jqlUsed: lastJql,
      issuesCreated: stats.issuesCreated,
      issuesUpdated: stats.issuesUpdated,
      linksSkipped: stats.linksSkipped,
      errorMessage: message,
    };
  }
}
