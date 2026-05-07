"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type {
  IssuePublicData,
  WorkstreamDerived,
} from "@/lib/narratives/derived";
import type { NarrativeWorkstream } from "@/lib/narratives/types";
import { IssueChip } from "./IssueChip";

const DESCRIPTION_TRUNCATE_AT = 150;

interface Props {
  workstream: NarrativeWorkstream;
  derived: WorkstreamDerived;
  issuesByKey: Map<string, IssuePublicData>;
}

export function WorkstreamCard({ workstream, derived, issuesByKey }: Props) {
  const [expanded, setExpanded] = useState(false);

  const desc = workstream.description ?? "";
  const isLongDesc = desc.length > DESCRIPTION_TRUNCATE_AT;
  const collapsedDesc = isLongDesc
    ? `${desc.slice(0, DESCRIPTION_TRUNCATE_AT)}…`
    : desc;

  return (
    <article
      id={`workstream-${workstream.id}`}
      className="flex scroll-mt-20 flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-text-primary group-data-[mode=presentation]/preview:text-xl">
            {workstream.name}
          </h3>
          <CountsRow derived={derived} />
        </div>
        <ProgressBadge progress={derived.progress} />
      </header>

      {desc ? (
        <p className="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-text-primary group-data-[mode=presentation]/preview:text-base">
          {expanded ? desc : collapsedDesc}
        </p>
      ) : null}

      {expanded && workstream.jira_issue_keys.length > 0 ? (
        <div
          data-collapsible
          data-expanded="true"
          className="flex flex-col gap-2"
        >
          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Issues vinculadas ({workstream.jira_issue_keys.length})
          </h4>
          <ul className="flex flex-col gap-1.5">
            {workstream.jira_issue_keys.map((key) => (
              <IssueChip
                key={key}
                issueKey={key}
                issue={issuesByKey.get(key)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {isLongDesc || derived.totalKeys > 0 ? (
        <div className="flex items-center justify-between border-t border-border pt-2.5">
          <span className="text-xs text-text-muted">
            {derived.totalKeys === 0
              ? "Sin issues vinculadas."
              : expanded
                ? "Mostrando detalle completo."
                : "Click para ver detalle."}
          </span>
          <button
            type="button"
            data-print="hide"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50"
          >
            <ChevronDown
              className={`size-3.5 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
            {expanded ? "Ver menos" : "Ver detalles"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function CountsRow({ derived }: { derived: WorkstreamDerived }) {
  const parts: string[] = [];
  if (derived.foundIssues > 0) {
    parts.push(
      `${derived.foundIssues} issue${derived.foundIssues === 1 ? "" : "s"}`,
    );
  }
  if (derived.missingKeys.length > 0) {
    parts.push(
      `${derived.missingKeys.length} sin sincronizar`,
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
      {parts.length > 0 ? (
        <span>{parts.join(" • ")}</span>
      ) : (
        <span className="italic">Sin issues vinculadas</span>
      )}
      {derived.overdueCount > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-error-bg px-2 py-0.5 text-[10px] font-semibold text-error">
          <AlertTriangle className="size-3" aria-hidden="true" />
          {derived.overdueCount} atrasada
          {derived.overdueCount === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}

// Three buckets — done / in progress / not started. The "in progress"
// bucket uses the lavender exception that PhaseSection's STATUS_PALETTE
// also applies (see CLAUDE.md "Iteration 4h Round 4" for why preview
// diverges from the roadmap's blue here).
function ProgressBadge({ progress }: { progress: number }) {
  const tone =
    progress === 100
      ? "bg-success-bg text-success"
      : progress >= 50
        ? "bg-primary-100 text-primary-700"
        : "bg-warm-100 text-text-secondary";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}
    >
      {progress}%
    </span>
  );
}
