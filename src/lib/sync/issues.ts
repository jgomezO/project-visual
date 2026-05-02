import "server-only";
import type { JiraClient } from "@/lib/jira/client";
import {
  JIRA_START_DATE_FIELD_ID,
  type JiraIssueFields,
  type JiraIssueLink,
  type JiraSearchIssue,
} from "@/lib/jira/types";
import { getServiceSupabase } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";

const PAGE_SIZE = 100;

export interface SyncIssuesResult {
  syncType: "full" | "incremental";
  jql: string;
  issuesCreated: number;
  issuesUpdated: number;
  linksSkipped: number;
}

function escapeJql(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function statusCategoryName(
  raw: Record<string, unknown>,
): "To Do" | "In Progress" | "Done" {
  const fields = raw as JiraIssueFields;
  const name = fields.status?.statusCategory?.name;
  if (name === "To Do" || name === "In Progress" || name === "Done") {
    return name;
  }
  // Fall back to category key (Jira uses 'new' | 'indeterminate' | 'done').
  const key = fields.status?.statusCategory?.key;
  if (key === "done") return "Done";
  if (key === "indeterminate") return "In Progress";
  return "To Do";
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseJiraDate(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  if (!DATE_RE.test(value)) return null;
  return value;
}

// parent_id is set to null on insert and backfilled in a second pass — this
// avoids self-FK violations when an issue and its parent are in the same
// upsert batch (e.g., a story and its epic in the same Jira page response).
function toIssueRow(issue: JiraSearchIssue, projectId: string) {
  const fields = issue.fields as JiraIssueFields;
  return {
    id: issue.id,
    key: issue.key,
    project_id: projectId,
    summary: fields.summary ?? "",
    issue_type: fields.issuetype?.name ?? "Unknown",
    status_name: fields.status?.name ?? "Unknown",
    status_category: statusCategoryName(issue.fields),
    assignee_account_id: fields.assignee?.accountId ?? null,
    assignee_display_name: fields.assignee?.displayName ?? null,
    priority: fields.priority?.name ?? null,
    parent_id: null as string | null,
    due_date: fields.duedate ?? null,
    start_date: parseJiraDate(fields[JIRA_START_DATE_FIELD_ID]),
    created_at_jira: fields.created ?? null,
    updated_at_jira: fields.updated ?? null,
    raw: issue as unknown as Json,
    synced_at: new Date().toISOString(),
  };
}

interface LinkRow {
  source_issue_id: string;
  target_issue_id: string | null;
  target_issue_key: string;
  link_type: string;
}

function toLinkRow(sourceIssueId: string, link: JiraIssueLink): LinkRow | null {
  if (link.outwardIssue) {
    return {
      source_issue_id: sourceIssueId,
      target_issue_id: null,
      target_issue_key: link.outwardIssue.key,
      link_type: link.type.outward,
    };
  }
  if (link.inwardIssue) {
    return {
      source_issue_id: sourceIssueId,
      target_issue_id: null,
      target_issue_key: link.inwardIssue.key,
      link_type: link.type.inward,
    };
  }
  return null;
}

export async function syncIssuesForProject(
  jira: JiraClient,
  projectKey: string,
  options?: { full?: boolean },
): Promise<SyncIssuesResult> {
  const supabase = getServiceSupabase();

  const { data: project, error: projError } = await supabase
    .from("projects")
    .select("id, last_synced_at")
    .eq("key", projectKey)
    .maybeSingle();
  if (projError) throw projError;
  if (!project) {
    throw new Error(
      `Project "${projectKey}" not found in DB; run syncProjects() first.`,
    );
  }

  const isFull = options?.full ?? !project.last_synced_at;
  const escaped = escapeJql(projectKey);
  let jql: string;
  if (isFull) {
    jql = `project = "${escaped}"`;
  } else {
    // Watermark = last_synced_at - 1 day buffer (date-only). The buffer
    // absorbs Jira's TZ ambiguity with JQL date strings (interpreted in
    // the token user's timezone, not UTC). Cheap re-pull on low volume.
    const watermark = new Date(project.last_synced_at!);
    watermark.setUTCDate(watermark.getUTCDate() - 1);
    const dateStr = watermark.toISOString().slice(0, 10);
    jql = `project = "${escaped}" AND updated >= "${dateStr}"`;
  }

  const startedAt = new Date().toISOString();
  let issuesCreated = 0;
  let issuesUpdated = 0;
  let linksSkipped = 0;
  // Collected during pass 1, applied in pass 2 to avoid self-FK violations.
  const parentUpdates: Array<{ id: string; parentId: string }> = [];

  for await (const page of jira.searchIssuesPaginated({
    jql,
    fields: ["*all"],
    maxResults: PAGE_SIZE,
  })) {
    if (page.length === 0) continue;

    const issueRows = page.map((issue) => toIssueRow(issue, project.id));
    const ids = issueRows.map((r) => r.id);

    // Detect created vs updated by checking which ids existed before upsert.
    const { data: existing, error: existingError } = await supabase
      .from("issues")
      .select("id")
      .in("id", ids);
    if (existingError) throw existingError;
    const existingSet = new Set((existing ?? []).map((r) => r.id));

    const { error: upsertError } = await supabase
      .from("issues")
      .upsert(issueRows, { onConflict: "id" });
    if (upsertError) throw upsertError;

    for (const row of issueRows) {
      if (existingSet.has(row.id)) issuesUpdated++;
      else issuesCreated++;
    }

    for (const issue of page) {
      const fields = issue.fields as JiraIssueFields;
      if (fields.parent?.id) {
        parentUpdates.push({ id: issue.id, parentId: fields.parent.id });
      }

      // Upsert links from this page. target_issue_id stays null here; we
      // backfill below once all pages are synced (the target may be in a
      // later page or in another already-synced project).
      const links = fields.issuelinks ?? [];
      for (const link of links) {
        const row = toLinkRow(issue.id, link);
        if (!row) {
          linksSkipped++;
          continue;
        }
        const { error: linkError } = await supabase
          .from("issue_links")
          .upsert([row], {
            onConflict: "source_issue_id,target_issue_key,link_type",
          });
        if (linkError) {
          console.error(
            `[sync] link upsert failed for ${issue.key} -> ${row.target_issue_key}: ${linkError.message}`,
          );
          linksSkipped++;
        }
      }
    }
  }

  // Pass 2: backfill parent_id on all issues that have a parent now that
  // every issue has been inserted (avoids self-FK violations).
  await backfillParentIds(parentUpdates);

  // Backfill target_issue_id for links whose target now exists in DB.
  await backfillIssueLinkTargets();

  const { error: stampError } = await supabase
    .from("projects")
    .update({ last_synced_at: startedAt })
    .eq("id", project.id);
  if (stampError) throw stampError;

  return {
    syncType: isFull ? "full" : "incremental",
    jql,
    issuesCreated,
    issuesUpdated,
    linksSkipped,
  };
}

async function backfillParentIds(
  updates: Array<{ id: string; parentId: string }>,
): Promise<void> {
  if (updates.length === 0) return;
  const supabase = getServiceSupabase();

  // Filter to parents that actually exist in DB. Cross-project parents
  // (e.g., outside JIRA_PROJECT_KEYS) stay unset; we don't have the row.
  const parentIds = [...new Set(updates.map((u) => u.parentId))];
  const { data: existing, error: existsErr } = await supabase
    .from("issues")
    .select("id")
    .in("id", parentIds);
  if (existsErr) throw existsErr;
  const existingSet = new Set((existing ?? []).map((r) => r.id));

  // Group child ids by parent_id; one UPDATE per parent.
  const groups = new Map<string, string[]>();
  for (const { id, parentId } of updates) {
    if (!existingSet.has(parentId)) continue;
    const ids = groups.get(parentId) ?? [];
    ids.push(id);
    groups.set(parentId, ids);
  }

  for (const [parentId, childIds] of groups) {
    const { error } = await supabase
      .from("issues")
      .update({ parent_id: parentId })
      .in("id", childIds);
    if (error) throw error;
  }
}

async function backfillIssueLinkTargets(): Promise<void> {
  const supabase = getServiceSupabase();

  const { data: nullLinks, error: nullErr } = await supabase
    .from("issue_links")
    .select("id, target_issue_key")
    .is("target_issue_id", null);
  if (nullErr) throw nullErr;
  if (!nullLinks || nullLinks.length === 0) return;

  const targetKeys = [...new Set(nullLinks.map((l) => l.target_issue_key))];
  const { data: matches, error: matchErr } = await supabase
    .from("issues")
    .select("id, key")
    .in("key", targetKeys);
  if (matchErr) throw matchErr;
  const keyToId = new Map((matches ?? []).map((i) => [i.key, i.id]));
  if (keyToId.size === 0) return;

  // Group link ids by resolved target_issue_id, do one update per group.
  const updates = new Map<string, number[]>();
  for (const link of nullLinks) {
    const id = keyToId.get(link.target_issue_key);
    if (!id) continue;
    const list = updates.get(id) ?? [];
    list.push(link.id);
    updates.set(id, list);
  }

  for (const [targetId, linkIds] of updates) {
    const { error } = await supabase
      .from("issue_links")
      .update({ target_issue_id: targetId })
      .in("id", linkIds);
    if (error) {
      console.error(
        `[sync] link backfill failed for target ${targetId}: ${error.message}`,
      );
    }
  }
}
