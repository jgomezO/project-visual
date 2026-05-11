"use client";

import {
  AlertTriangle,
  ExternalLink,
  Trash2,
  User,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { StatusChip } from "@/components/project/StatusChip";
import type { IssuePublicData } from "@/lib/narratives/derived";
import { getIssueTypeMeta, IssueTypeIcon } from "./issueTypeIcon";

interface Props {
  issueKey: string;
  issue: IssuePublicData | undefined;
}

// Single row inside an expanded WorkstreamCard. Server-rendered: data
// arrives precomputed from the page-level batch query, so this is pure
// presentation. Three states:
//   * known issue        → full row (summary, status, assignee, Jira link)
//   * missing from sync  → warning row, key only (never synced upstream)
//   * deleted in Jira    → tombstone row: line-through summary, gray
//                          tone, Trash2 icon, status chip preserved as
//                          last known state, link to Jira disabled
//                          (the page is gone)
//
// Marked "use client" because the issue-type label is resolved via
// useTranslations (common.issueType.*) and both consumers (WorkstreamCard
// + DependencyCard) are already client components, so this doesn't add
// a new server/client boundary.
export function IssueChip({ issueKey, issue }: Props) {
  const t = useTranslations("preview.issueChip");
  const tType = useTranslations("common.issueType");
  const format = useFormatter();
  const jiraBase = process.env.NEXT_PUBLIC_JIRA_BASE_URL?.replace(/\/$/, "");
  const jiraHref = jiraBase ? `${jiraBase}/browse/${issueKey}` : null;

  if (!issue) {
    return (
      <li className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning-bg px-3 py-2 text-sm">
        <AlertTriangle
          className="size-4 shrink-0 text-warning"
          aria-hidden="true"
        />
        <span className="font-mono text-xs text-warm-700">{issueKey}</span>
        <span className="text-xs text-warm-700">{t("notInSync")}</span>
      </li>
    );
  }

  const typeKey = getIssueTypeMeta(issue.issue_type).key;
  const typeLabel = tType(typeKey);
  const isDeleted = issue.deleted_at !== null;

  if (isDeleted) {
    const dateLabel = format.dateTime(new Date(issue.deleted_at!), {
      dateStyle: "medium",
      timeZone: "UTC",
    });
    return (
      <li
        className="flex items-start gap-2.5 rounded-md border border-border bg-warm-50/40 px-3 py-2 text-sm opacity-70"
        title={t("deletedTooltip", { date: dateLabel })}
      >
        <span className="flex flex-1 flex-wrap items-center gap-2">
          <IssueTypeIcon rawType={issue.issue_type} label={typeLabel} />
          <Trash2
            className="size-3.5 shrink-0 text-text-muted"
            aria-label={t("deletedLabel")}
          />
          <span className="font-mono text-xs text-text-muted line-through">
            {issueKey}
          </span>
          <span className="min-w-0 flex-1 truncate text-text-muted line-through">
            {issue.summary}
          </span>
          <StatusChip
            category={issue.status_category}
            statusName={issue.status_name}
          />
        </span>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2.5 rounded-md border border-border bg-warm-50/60 px-3 py-2 text-sm">
      <a
        href={jiraHref ?? "#"}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!jiraHref}
        title={
          issue.assignee_display_name
            ? t("assignedTo", { name: issue.assignee_display_name })
            : undefined
        }
        className="group/issue flex flex-1 flex-wrap items-center gap-2 hover:underline"
      >
        <IssueTypeIcon rawType={issue.issue_type} label={typeLabel} />
        <span className="font-mono text-xs text-text-muted">{issueKey}</span>
        <span className="min-w-0 flex-1 truncate text-text-primary">
          {issue.summary}
        </span>
        <StatusChip
          category={issue.status_category}
          statusName={issue.status_name}
        />
        {issue.assignee_display_name ? (
          <span className="hidden items-center gap-1 text-xs text-text-muted sm:inline-flex">
            <User className="size-3" aria-hidden="true" />
            {issue.assignee_display_name}
          </span>
        ) : null}
        {jiraHref ? (
          <ExternalLink
            className="size-3.5 text-text-muted opacity-0 transition-opacity group-hover/issue:opacity-100 motion-reduce:transition-none"
            aria-hidden="true"
          />
        ) : null}
      </a>
    </li>
  );
}
