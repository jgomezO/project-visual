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

export async function runSync(args: RunSyncArgs = {}): Promise<RunSyncResult> {
  const declaredType: "full" | "incremental" = args.type ?? "incremental";
  const projectKeyFilter = args.projectKey ?? null;

  // Open the run early so we always have a row to update on failure.
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
    const message = e instanceof Error ? e.message : String(e);
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
