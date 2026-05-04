import { AlertTriangle, ExternalLink, User } from "lucide-react";
import { StatusChip } from "@/components/project/StatusChip";
import type { IssuePublicData } from "@/lib/narratives/derived";
import { IssueTypeIcon } from "./issueTypeIcon";

interface Props {
  issueKey: string;
  issue: IssuePublicData | undefined;
}

// Single row inside an expanded WorkstreamCard. Server-rendered: data
// arrives precomputed from the page-level batch query, so this is pure
// presentation. Two states: known issue (full row with summary, status,
// assignee tooltip-style hint, Jira link) and missing-from-sync
// (warning row with key only — does not break the rest of the card).
export function IssueChip({ issueKey, issue }: Props) {
  const jiraBase = process.env.NEXT_PUBLIC_JIRA_BASE_URL?.replace(/\/$/, "");
  const jiraHref = jiraBase ? `${jiraBase}/browse/${issueKey}` : null;

  if (!issue) {
    return (
      <li className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
        <AlertTriangle
          className="size-4 shrink-0 text-amber-600"
          aria-hidden="true"
        />
        <span className="font-mono text-xs text-amber-800">{issueKey}</span>
        <span className="text-xs text-amber-700">
          Issue no encontrada en sync.
        </span>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2.5 rounded-md border border-default-200 bg-default-50/60 px-3 py-2 text-sm">
      <a
        href={jiraHref ?? "#"}
        target="_blank"
        rel="noreferrer"
        aria-disabled={!jiraHref}
        title={
          issue.assignee_display_name
            ? `Asignado a ${issue.assignee_display_name}`
            : undefined
        }
        className="group/issue flex flex-1 flex-wrap items-center gap-2 hover:underline"
      >
        <IssueTypeIcon rawType={issue.issue_type} />
        <span className="font-mono text-xs text-muted">{issueKey}</span>
        <span className="flex-1 min-w-0 truncate text-foreground">
          {issue.summary}
        </span>
        <StatusChip
          category={issue.status_category}
          statusName={issue.status_name}
        />
        {issue.assignee_display_name ? (
          <span className="hidden items-center gap-1 text-xs text-muted sm:inline-flex">
            <User className="size-3" aria-hidden="true" />
            {issue.assignee_display_name}
          </span>
        ) : null}
        {jiraHref ? (
          <ExternalLink
            className="size-3.5 text-muted opacity-0 transition-opacity group-hover/issue:opacity-100 motion-reduce:transition-none"
            aria-hidden="true"
          />
        ) : null}
      </a>
    </li>
  );
}
