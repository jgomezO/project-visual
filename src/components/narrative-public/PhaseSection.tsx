"use client";

import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import type {
  IssuePublicData,
  PhaseDerived,
  WorkstreamDerived,
} from "@/lib/narratives/derived";
import type {
  NarrativePhaseWithWorkstreams,
  PhaseStatus,
} from "@/lib/narratives/types";
import { WorkstreamCard } from "./WorkstreamCard";

const STATUS_LABEL: Record<PhaseStatus, string> = {
  upcoming: "Próxima",
  in_progress: "En curso",
  completed: "Completada",
  at_risk: "En riesgo",
};

// One palette per status, expressed in Prism functional tokens. Border
// lateral (color-coded) + badge bg/text + progress fill share a hue so
// a quick scan reads the phase status from any of the three signals.
//
// Intentional asymmetry: `in_progress` here uses LAVENDER (primary-*),
// while the operational roadmap at /projects/[key]?view=roadmap renders
// in-progress epics in BLUE (bg-info). Different audiences, different
// metaphors:
//   - Roadmap = operational. PMs scanning execution; lavender would
//     blur with brand identity and stop reading as a status signal.
//   - Preview = presentational. Stakeholders / C-level reading a live
//     narrative; lavender communicates vitality and ties the active
//     phase visually to the brand.
// If a future refactor tries to consolidate the two for "consistency",
// the asymmetry is the design intent — not a bug. See CLAUDE.md
// "Iteration 4h Round 4" for the full rationale.
const STATUS_PALETTE: Record<
  PhaseStatus,
  {
    border: string;
    badgeBg: string;
    badgeText: string;
    progressFill: string;
    progressTrack: string;
  }
> = {
  completed: {
    border: "border-l-success",
    badgeBg: "bg-success-bg",
    badgeText: "text-success",
    progressFill: "bg-success",
    progressTrack: "bg-success-bg",
  },
  in_progress: {
    border: "border-l-primary-500",
    badgeBg: "bg-primary-100",
    badgeText: "text-primary-700",
    progressFill: "bg-primary-500",
    progressTrack: "bg-primary-100",
  },
  upcoming: {
    border: "border-l-text-muted",
    badgeBg: "bg-warm-100",
    badgeText: "text-text-secondary",
    progressFill: "bg-text-muted",
    progressTrack: "bg-warm-100",
  },
  at_risk: {
    border: "border-l-warning",
    badgeBg: "bg-warning-bg",
    // text-warning at L=0.75 is too light for chip text on warning-bg;
    // warm-700 (L=0.55, same hue family) gives readable contrast.
    badgeText: "text-warm-700",
    progressFill: "bg-warning",
    progressTrack: "bg-warning-bg",
  },
};

interface Props {
  phase: NarrativePhaseWithWorkstreams;
  derived: PhaseDerived;
  workstreamDerived: Map<string, WorkstreamDerived>;
  issuesByKey: Map<string, IssuePublicData>;
  index: number;
}

export function PhaseSection({
  phase,
  derived,
  workstreamDerived,
  issuesByKey,
  index,
}: Props) {
  const [showRationale, setShowRationale] = useState(false);
  const status = (phase.status as PhaseStatus) ?? "upcoming";
  const palette = STATUS_PALETTE[status];
  const dateRange = formatDateRange(phase.start_date, phase.end_date);

  return (
    <section
      className={`flex flex-col gap-4 rounded-xl border border-border border-l-4 bg-surface p-6 shadow-sm ${palette.border}`}
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${palette.badgeBg} ${palette.badgeText}`}
          >
            {STATUS_LABEL[status]}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Fase {index + 1}
          </span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary group-data-[mode=presentation]/preview:text-3xl">
          {phase.name}
        </h2>
      </header>

      {phase.objective ? (
        <p className="max-w-[70ch] text-base leading-relaxed text-text-primary group-data-[mode=presentation]/preview:text-lg">
          <span className="font-semibold text-text-secondary">Objetivo: </span>
          {phase.objective}
        </p>
      ) : null}

      {phase.rationale ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-print="hide"
            onClick={() => setShowRationale((v) => !v)}
            aria-expanded={showRationale}
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary-700 transition-colors hover:text-primary-800 hover:underline"
          >
            <ChevronDown
              className={`size-4 transition-transform motion-reduce:transition-none ${showRationale ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
            {showRationale ? "Ocultar el por qué" : "Ver el por qué"}
          </button>
          <div
            data-collapsible
            data-expanded={showRationale ? "true" : "false"}
            className="grid overflow-hidden transition-all duration-200 motion-reduce:transition-none data-[expanded=false]:grid-rows-[0fr] data-[expanded=true]:grid-rows-[1fr]"
          >
            <div className="min-h-0">
              <p className="max-w-[70ch] rounded-md bg-warm-50 p-3 text-sm leading-relaxed text-text-primary group-data-[mode=presentation]/preview:text-base">
                {phase.rationale}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <ProgressRow
        progress={derived.progress}
        palette={palette}
        hasManual={derived.hasManualProgress}
        workstreamCount={derived.workstreamCount}
        totalIssues={derived.totalIssues}
      />

      {dateRange ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Calendar className="size-4" aria-hidden="true" />
          <span>{dateRange}</span>
        </div>
      ) : null}

      {phase.workstreams.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Workstreams ({phase.workstreams.length})
          </h3>
          <div className="flex flex-col gap-3">
            {phase.workstreams.map((ws) => {
              const d = workstreamDerived.get(ws.id);
              if (!d) return null;
              return (
                <WorkstreamCard
                  key={ws.id}
                  workstream={ws}
                  derived={d}
                  issuesByKey={issuesByKey}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ProgressRow({
  progress,
  palette,
  hasManual,
  workstreamCount,
  totalIssues,
}: {
  progress: number;
  palette: (typeof STATUS_PALETTE)[PhaseStatus];
  hasManual: boolean;
  workstreamCount: number;
  totalIssues: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-primary">
          {progress}% completado
        </span>
        <span className="text-text-muted">
          {workstreamCount} workstream{workstreamCount === 1 ? "" : "s"}
          {totalIssues > 0
            ? ` · ${totalIssues} issue${totalIssues === 1 ? "" : "s"}`
            : ""}
          {hasManual ? " · ajustado manualmente" : ""}
        </span>
      </div>
      <div
        className={`h-2 overflow-hidden rounded-full ${palette.progressTrack}`}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${palette.progressFill}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function formatDateRange(
  start: string | null,
  end: string | null,
): string | null {
  if (!start && !end) return null;
  const fmt = (iso: string): string => {
    // ISO date YYYY-MM-DD interpreted as UTC to match how we store it.
    const [y, m, d] = iso.split("-").map((s) => Number(s));
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  if (start && end) return `${fmt(start)} → ${fmt(end)}`;
  if (start) return `Desde ${fmt(start)}`;
  return `Hasta ${fmt(end as string)}`;
}
