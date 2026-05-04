"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import type { WorkstreamDerived } from "@/lib/narratives/derived";
import type { NarrativeWorkstream } from "@/lib/narratives/types";

const DESCRIPTION_TRUNCATE_AT = 150;

interface Props {
  workstream: NarrativeWorkstream;
  derived: WorkstreamDerived;
}

export function WorkstreamCard({ workstream, derived }: Props) {
  const [expanded, setExpanded] = useState(false);

  const desc = workstream.description ?? "";
  const isLongDesc = desc.length > DESCRIPTION_TRUNCATE_AT;
  const collapsedDesc = isLongDesc
    ? `${desc.slice(0, DESCRIPTION_TRUNCATE_AT)}…`
    : desc;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-default-200 bg-surface p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-foreground group-data-[mode=presentation]/preview:text-xl">
            {workstream.name}
          </h3>
          <CountsRow derived={derived} />
        </div>
        <ProgressBadge progress={derived.progress} />
      </header>

      {desc ? (
        <p className="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-foreground group-data-[mode=presentation]/preview:text-base">
          {expanded ? desc : collapsedDesc}
        </p>
      ) : null}

      {/* Issue list lands in commit 4. The expand control is wired now
          so the disclosure behaviour is testable end-to-end. */}
      {(isLongDesc || derived.totalKeys > 0) ? (
        <div className="flex items-center justify-between border-t border-default-100 pt-2.5">
          <span className="text-xs text-muted">
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
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
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
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
      {parts.length > 0 ? (
        <span>{parts.join(" • ")}</span>
      ) : (
        <span className="italic">Sin issues vinculadas</span>
      )}
      {derived.overdueCount > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
          <AlertTriangle className="size-3" aria-hidden="true" />
          {derived.overdueCount} atrasada
          {derived.overdueCount === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}

function ProgressBadge({ progress }: { progress: number }) {
  const tone =
    progress === 100
      ? "bg-emerald-100 text-emerald-700"
      : progress >= 50
        ? "bg-blue-100 text-blue-700"
        : "bg-zinc-200 text-zinc-700";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}
    >
      {progress}%
    </span>
  );
}
