"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ExternalLink } from "lucide-react";
import type {
  DependencyDerived,
  IssuePublicData,
} from "@/lib/narratives/derived";
import type {
  NarrativeDependency,
  NarrativeWithChildren,
  RiskLevel,
} from "@/lib/narratives/types";
import { IssueChip } from "./IssueChip";

const COORDINATION_TRUNCATE_AT = 220;

const STATUS_LABEL: Record<string, string> = {
  proposed: "Propuesto",
  agreed: "Acordado",
  confirmed: "Confirmado",
  at_risk: "En riesgo",
  blocked: "Bloqueado",
};

// Lateral border + dot color per risk level. Visual polish (proper
// CommitmentStatusChip + DateGapIndicator components) lands in commit 6;
// here the rendering is intentionally plain so the cards are readable
// end-to-end without depending on those primitives.
const RISK_BORDER: Record<RiskLevel, string> = {
  low: "border-l-default-300",
  medium: "border-l-amber-500",
  high: "border-l-orange-500",
  critical: "border-l-red-600",
};

const RISK_DOT: Record<RiskLevel, string> = {
  low: "bg-default-300",
  medium: "bg-amber-500",
  high: "bg-orange-500",
  critical: "bg-red-600",
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
  const jiraBase = process.env.NEXT_PUBLIC_JIRA_BASE_URL?.replace(/\/$/, "");
  const projectHref =
    dependency.provider_pod_project_key && jiraBase
      ? `${jiraBase}/projects/${dependency.provider_pod_project_key}`
      : null;

  const impactedWorkstream = dependency.workstream_id
    ? findWorkstream(tree, dependency.workstream_id)
    : null;

  return (
    <article
      id={`dep-${dependency.id}`}
      className={`flex flex-col gap-4 rounded-xl border border-default-200 border-l-4 bg-surface p-5 shadow-sm ${RISK_BORDER[derived.riskLevel]}`}
    >
      <header className="flex items-start gap-3">
        <span
          className={`mt-1.5 inline-block size-2.5 shrink-0 rounded-full ${RISK_DOT[derived.riskLevel]}`}
          aria-label={`Nivel de riesgo: ${derived.riskLevel}`}
        />
        <h3 className="text-lg font-semibold tracking-tight text-foreground group-data-[mode=presentation]/preview:text-xl">
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
        <p className="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-foreground group-data-[mode=presentation]/preview:text-base">
          {dependency.description}
        </p>
      ) : null}

      <DatesBlock derived={derived} dependency={dependency} />

      <div className="flex items-center gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Estado del compromiso:
        </span>
        <span className="font-medium text-foreground">
          {STATUS_LABEL[dependency.commitment_status] ??
            dependency.commitment_status}
        </span>
      </div>

      {dependency.coordination_notes ? (
        <CoordinationNotes notes={dependency.coordination_notes} />
      ) : null}

      <footer className="border-t border-default-100 pt-3 text-xs text-muted">
        Impacta a:{" "}
        {impactedWorkstream ? (
          <a
            href={`#workstream-${impactedWorkstream.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {impactedWorkstream.name}
          </a>
        ) : (
          <span className="font-medium text-foreground">
            Toda la narrativa
          </span>
        )}
      </footer>
    </article>
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
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-default-50/60 p-3">
      <header className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Provider
        </span>
        {dependency.provider_pod ? (
          projectHref ? (
            <a
              href={projectHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-200"
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
            <span className="inline-flex items-center gap-1 rounded-full bg-default-100 px-2.5 py-0.5 text-xs font-medium text-foreground">
              {dependency.provider_pod}
              {dependency.provider_pod_project_key ? (
                <span className="font-mono text-[10px] text-muted">
                  · {dependency.provider_pod_project_key}
                </span>
              ) : null}
            </span>
          )
        ) : (
          <span className="text-xs italic text-muted">
            Sin provider definido
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

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span>
          Progreso del lado provider:{" "}
          <strong className="font-semibold text-foreground">
            {derived.providerIssuesData.aggregateProgress}%
          </strong>
        </span>
        {derived.providerIssuesData.missing.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-amber-700">
            <AlertTriangle className="size-3" aria-hidden="true" />
            {derived.providerIssuesData.missing.length} sin sincronizar
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
  const needed = dependency.needed_by_date;
  const expected = derived.resolvedExpectedDeliveryDate;
  if (!needed && !expected) return null;

  const expectedIsDerived =
    !dependency.expected_delivery_date && expected !== null;

  return (
    <section className="flex flex-col gap-2 rounded-lg bg-default-50/60 p-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
        {needed ? (
          <span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Necesitamos:
            </span>{" "}
            <span className="font-medium text-foreground">
              {formatDate(needed)}
            </span>
          </span>
        ) : null}
        {expected ? (
          <span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              Entrega:
            </span>{" "}
            <span className="font-medium text-foreground">
              {formatDate(expected)}
              {expectedIsDerived ? (
                <span className="ml-1 text-xs font-normal text-muted">
                  (estimado por issues)
                </span>
              ) : null}
            </span>
          </span>
        ) : null}
      </div>
      {/* DateGapIndicator (proper chip with red/green/neutral variants)
          ships in commit 6. Plain inline text here keeps commit 5
          self-contained but readable. */}
      <DelayLine delayRiskDays={derived.delayRiskDays} />
    </section>
  );
}

function DelayLine({ delayRiskDays }: { delayRiskDays: number | null }) {
  if (delayRiskDays === null) return null;
  if (delayRiskDays > 0) {
    return (
      <p className="text-sm font-medium text-red-700">
        ⚠ {delayRiskDays} día{delayRiskDays === 1 ? "" : "s"} de retraso
        esperado.
      </p>
    );
  }
  if (delayRiskDays === 0) {
    return (
      <p className="text-sm font-medium text-emerald-700">
        ✓ Justo a tiempo.
      </p>
    );
  }
  const margin = -delayRiskDays;
  return (
    <p className="text-sm font-medium text-emerald-700">
      ✓ {margin} día{margin === 1 ? "" : "s"} de margen.
    </p>
  );
}

function CoordinationNotes({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = notes.length > COORDINATION_TRUNCATE_AT;
  const display =
    !isLong || expanded
      ? notes
      : `${notes.slice(0, COORDINATION_TRUNCATE_AT)}…`;

  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
        Esfuerzo de coordinación
      </h4>
      <p className="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-foreground group-data-[mode=presentation]/preview:text-base">
        {display}
      </p>
      {isLong ? (
        <button
          type="button"
          data-print="hide"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
        >
          <ChevronDown
            className={`size-3.5 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          {expanded ? "Ver menos" : "Leer más"}
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

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
