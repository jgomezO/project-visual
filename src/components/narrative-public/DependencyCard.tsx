"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import type {
  DependencyDerived,
  IssuePublicData,
} from "@/lib/narratives/derived";
import type {
  CommitmentStatus,
  NarrativeDependency,
  NarrativeRisk,
  NarrativeWithChildren,
  RiskLevel,
} from "@/lib/narratives/types";
import { CommitmentStatusChip } from "./CommitmentStatusChip";
import { DateGapIndicator } from "./DateGapIndicator";
import { IssueChip } from "./IssueChip";

const COORDINATION_TRUNCATE_AT = 220;

// Lateral border + dot per risk level. Critical also gets a small
// AlertTriangle stamp inside the header so it reads as urgent at a
// glance even on grayscale prints.
//
// Prism palette (R4): low → muted gray, medium → warning (peach/amber),
// high → warm-700 (darker peach, distinct escalation step), critical →
// error (red). Prism doesn't ship a "danger" token between warning and
// error; warm-700 covers the gap by reusing the warm hue family at a
// darker lightness so the four-step escalation stays legible.
const RISK_BORDER: Record<RiskLevel, string> = {
  low: "border-l-text-muted/40",
  medium: "border-l-warning",
  high: "border-l-warm-700",
  critical: "border-l-error",
};

const RISK_DOT: Record<RiskLevel, string> = {
  low: "bg-text-muted/40",
  medium: "bg-warning",
  high: "bg-warm-700",
  critical: "bg-error",
};

interface Props {
  dependency: NarrativeDependency;
  derived: DependencyDerived;
  tree: NarrativeWithChildren;
  issuesByKey: Map<string, IssuePublicData>;
}

export function DependencyCard({
  dependency,
  derived,
  tree,
  issuesByKey,
}: Props) {
  const t = useTranslations("preview.dependency");
  const tRiskLevel = useTranslations("preview.dependency.riskLevel");
  const jiraBase = process.env.NEXT_PUBLIC_JIRA_BASE_URL?.replace(/\/$/, "");
  const projectHref =
    dependency.provider_pod_project_key && jiraBase
      ? `${jiraBase}/projects/${dependency.provider_pod_project_key}`
      : null;

  const impactedWorkstream = dependency.workstream_id
    ? findWorkstream(tree, dependency.workstream_id)
    : null;

  // Reverse cross-link: which risks declared this dep as related?
  // Computed inline; deps and risks per narrative are bounded so the
  // O(R) filter is fine. Order follows tree.risks (= order_index).
  const mentioningRisks = tree.risks.filter((r) =>
    r.related_dependency_ids.includes(dependency.id),
  );

  return (
    <article
      id={`dep-${dependency.id}`}
      className={`flex flex-col gap-4 rounded-xl border border-border border-l-4 bg-surface p-5 shadow-sm ${RISK_BORDER[derived.riskLevel]}`}
    >
      <header className="flex items-start gap-3">
        {derived.riskLevel === "critical" ? (
          <span
            className="mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-error-bg text-error"
            aria-label={tRiskLevel("critical")}
            title={tRiskLevel("critical")}
          >
            <AlertTriangle className="size-3.5" aria-hidden="true" />
          </span>
        ) : (
          <span
            className={`mt-1.5 inline-block size-2.5 shrink-0 rounded-full ${RISK_DOT[derived.riskLevel]}`}
            aria-label={tRiskLevel(derived.riskLevel)}
            title={tRiskLevel(derived.riskLevel)}
          />
        )}
        <span className="rounded-full bg-warm-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-text-muted">
          {dependency.identifier}
        </span>
        <h3 className="flex-1 text-lg font-semibold tracking-tight text-text-primary group-data-[mode=presentation]/preview:text-xl">
          {dependency.title}
        </h3>
      </header>

      <ProviderBlock
        dependency={dependency}
        derived={derived}
        issuesByKey={issuesByKey}
        projectHref={projectHref}
      />

      {dependency.description ? (
        <p className="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-text-primary group-data-[mode=presentation]/preview:text-base">
          {dependency.description}
        </p>
      ) : null}

      <DatesBlock derived={derived} dependency={dependency} />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t("commitmentLabel")}
        </span>
        <CommitmentStatusChip
          status={dependency.commitment_status as CommitmentStatus}
        />
      </div>

      {dependency.coordination_notes ? (
        <CoordinationNotes notes={dependency.coordination_notes} />
      ) : null}

      {mentioningRisks.length > 0 ? (
        <MentionedByRisks risks={mentioningRisks} />
      ) : null}

      <footer className="border-t border-border pt-3 text-xs text-text-muted">
        {t("impacts.label")}{" "}
        {impactedWorkstream ? (
          <a
            href={`#workstream-${impactedWorkstream.id}`}
            className="font-medium text-text-primary hover:underline"
          >
            {impactedWorkstream.name}
          </a>
        ) : (
          <span className="font-medium text-text-primary">
            {t("impacts.entireNarrative")}
          </span>
        )}
      </footer>
    </article>
  );
}

function MentionedByRisks({ risks }: { risks: NarrativeRisk[] }) {
  const t = useTranslations("preview.dependency");
  return (
    <section className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-text-muted">
      <span className="font-semibold uppercase tracking-wide">
        {t("mentionedBy")}
      </span>
      {risks.map((risk) => (
        <a
          key={risk.id}
          href={`#risk-${risk.id}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-medium text-text-primary transition-colors hover:bg-warm-200"
        >
          <span className="font-mono text-[10px] text-text-muted">
            {risk.identifier}
          </span>
          <span className="max-w-[16rem] truncate">{risk.title}</span>
        </a>
      ))}
    </section>
  );
}

function ProviderBlock({
  dependency,
  derived,
  issuesByKey,
  projectHref,
}: {
  dependency: NarrativeDependency;
  derived: DependencyDerived;
  issuesByKey: Map<string, IssuePublicData>;
  projectHref: string | null;
}) {
  const t = useTranslations("preview.dependency.provider");
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-warm-50/60 p-3">
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t("label")}
        </span>
        {dependency.provider_pod ? (
          projectHref ? (
            <a
              href={projectHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-0.5 text-xs font-medium text-info transition-colors hover:bg-info-bg/80"
            >
              {dependency.provider_pod}
              {dependency.provider_pod_project_key ? (
                <span className="font-mono text-[10px] opacity-70">
                  · {dependency.provider_pod_project_key}
                </span>
              ) : null}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-medium text-text-primary">
              {dependency.provider_pod}
              {dependency.provider_pod_project_key ? (
                <span className="font-mono text-[10px] text-text-muted">
                  · {dependency.provider_pod_project_key}
                </span>
              ) : null}
            </span>
          )
        ) : (
          <span className="text-xs italic text-text-muted">
            {t("notDefined")}
          </span>
        )}
      </header>

      {dependency.provider_jira_issue_keys.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {dependency.provider_jira_issue_keys.map((key) => (
            <IssueChip
              key={key}
              issueKey={key}
              issue={issuesByKey.get(key)}
            />
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span>
          {t("progress")}{" "}
          <strong className="font-semibold text-text-primary">
            {derived.providerIssuesData.aggregateProgress}%
          </strong>
        </span>
        {derived.providerIssuesData.missing.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-warm-700">
            <AlertTriangle className="size-3" aria-hidden="true" />
            {t("missing", { count: derived.providerIssuesData.missing.length })}
          </span>
        ) : null}
        {derived.providerIssuesData.deleted.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-text-muted">
            {t("deleted", { count: derived.providerIssuesData.deleted.length })}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function DatesBlock({
  derived,
  dependency,
}: {
  derived: DependencyDerived;
  dependency: NarrativeDependency;
}) {
  const t = useTranslations("preview.dependency.dates");
  const format = useFormatter();
  const needed = dependency.needed_by_date;
  const expected = derived.resolvedExpectedDeliveryDate;
  if (!needed && !expected) return null;

  const expectedIsDerived =
    !dependency.expected_delivery_date && expected !== null;

  const fmt = (iso: string): string => {
    const [y, m, d] = iso.split("-").map(Number);
    return format.dateTime(new Date(Date.UTC(y, m - 1, d)), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  return (
    <section className="flex flex-col gap-2 rounded-lg bg-warm-50/60 p-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
        {needed ? (
          <span>
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("neededLabel")}
            </span>{" "}
            <span className="font-medium text-text-primary">{fmt(needed)}</span>
          </span>
        ) : null}
        {expected ? (
          <span>
            <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t("expectedLabel")}
            </span>{" "}
            <span className="font-medium text-text-primary">
              {fmt(expected)}
              {expectedIsDerived ? (
                <span className="ml-1 text-xs font-normal text-text-muted">
                  {t("estimatedSuffix")}
                </span>
              ) : null}
            </span>
          </span>
        ) : null}
      </div>
      <DateGapIndicator
        delayRiskDays={derived.delayRiskDays}
        neededDate={dependency.needed_by_date}
        expectedDate={derived.resolvedExpectedDeliveryDate}
      />
    </section>
  );
}

function CoordinationNotes({ notes }: { notes: string }) {
  const t = useTranslations("preview.dependency.coordination");
  const [expanded, setExpanded] = useState(false);
  const isLong = notes.length > COORDINATION_TRUNCATE_AT;
  const display =
    !isLong || expanded
      ? notes
      : `${notes.slice(0, COORDINATION_TRUNCATE_AT)}…`;

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {t("heading")}
      </h4>
      <p className="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-text-primary group-data-[mode=presentation]/preview:text-base">
        {display}
      </p>
      {isLong ? (
        <button
          type="button"
          data-print="hide"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary-700 transition-colors hover:text-primary-800 hover:underline"
        >
          <ChevronDown
            className={`size-3.5 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          {expanded ? t("collapse") : t("expand")}
        </button>
      ) : null}
    </section>
  );
}

function findWorkstream(
  tree: NarrativeWithChildren,
  id: string,
): { id: string; name: string } | null {
  for (const phase of tree.phases) {
    for (const ws of phase.workstreams) {
      if (ws.id === id) return ws;
    }
  }
  for (const ws of tree.orphan_workstreams) {
    if (ws.id === id) return ws;
  }
  return null;
}
