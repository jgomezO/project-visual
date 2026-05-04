"use client";

import { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import type {
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

// One palette per status. Border lateral (color-coded) + badge bg/text +
// progress fill share a hue so a quick scan reads the phase status from
// any of the three signals.
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
    border: "border-l-emerald-500",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-700",
    progressFill: "bg-emerald-500",
    progressTrack: "bg-emerald-100",
  },
  in_progress: {
    border: "border-l-blue-500",
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-700",
    progressFill: "bg-blue-500",
    progressTrack: "bg-blue-100",
  },
  upcoming: {
    border: "border-l-zinc-400",
    badgeBg: "bg-zinc-200",
    badgeText: "text-zinc-700",
    progressFill: "bg-zinc-400",
    progressTrack: "bg-zinc-200",
  },
  at_risk: {
    border: "border-l-orange-500",
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-700",
    progressFill: "bg-orange-500",
    progressTrack: "bg-orange-100",
  },
};

interface Props {
  phase: NarrativePhaseWithWorkstreams;
  derived: PhaseDerived;
  workstreamDerived: Map<string, WorkstreamDerived>;
  index: number;
}

export function PhaseSection({
  phase,
  derived,
  workstreamDerived,
  index,
}: Props) {
  const [showRationale, setShowRationale] = useState(false);
  const status = (phase.status as PhaseStatus) ?? "upcoming";
  const palette = STATUS_PALETTE[status];
  const dateRange = formatDateRange(phase.start_date, phase.end_date);

  return (
    <section
      className={`flex flex-col gap-4 rounded-xl border border-default-200 border-l-4 bg-surface p-6 shadow-sm ${palette.border}`}
    >
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${palette.badgeBg} ${palette.badgeText}`}
          >
            {STATUS_LABEL[status]}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Fase {index + 1}
          </span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground group-data-[mode=presentation]/preview:text-3xl">
          {phase.name}
        </h2>
      </header>

      {phase.objective ? (
        <p className="max-w-[70ch] text-base leading-relaxed text-foreground group-data-[mode=presentation]/preview:text-lg">
          <span className="font-semibold text-muted">Objetivo: </span>
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
            className="inline-flex w-fit items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
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
              <p className="max-w-[70ch] rounded-md bg-default-50 p-3 text-sm leading-relaxed text-foreground group-data-[mode=presentation]/preview:text-base">
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
        <div className="flex items-center gap-2 text-sm text-muted">
          <Calendar className="size-4" aria-hidden="true" />
          <span>{dateRange}</span>
        </div>
      ) : null}

      {phase.workstreams.length > 0 ? (
        <div className="flex flex-col gap-3 border-t border-default-200 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
            Workstreams ({phase.workstreams.length})
          </h3>
          <div className="flex flex-col gap-3">
            {phase.workstreams.map((ws) => {
              const d = workstreamDerived.get(ws.id);
              if (!d) return null;
              return (
                <WorkstreamCard key={ws.id} workstream={ws} derived={d} />
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
        <span className="font-medium text-foreground">{progress}% completado</span>
        <span className="text-muted">
          {workstreamCount} workstream{workstreamCount === 1 ? "" : "s"}
          {totalIssues > 0
            ? ` · ${totalIssues} issue${totalIssues === 1 ? "" : "s"}`
            : ""}
          {hasManual ? " · estimado por PM" : ""}
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
