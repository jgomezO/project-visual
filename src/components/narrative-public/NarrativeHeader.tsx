"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type { ProjectNarrative } from "@/lib/narratives/types";
import { relativeFromNow } from "@/lib/format/relativeTime";

const OVERVIEW_TRUNCATE_AT = 300;

interface Props {
  narrative: ProjectNarrative;
  projectKey: string;
  projectName: string;
  globalProgress: number;
  totalWorkstreams: number;
  totalIssues: number;
  totalDependencies: number;
  criticalDependencyCount: number;
}

export function NarrativeHeader({
  narrative,
  projectKey,
  projectName,
  globalProgress,
  totalWorkstreams,
  totalIssues,
  totalDependencies,
  criticalDependencyCount,
}: Props) {
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight text-foreground group-data-[mode=presentation]/preview:text-5xl">
          {narrative.title}
        </h1>
        {narrative.subtitle ? (
          <p className="text-xl font-normal text-muted group-data-[mode=presentation]/preview:text-2xl">
            {narrative.subtitle}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted group-data-[mode=presentation]/preview:text-base">
        <Link
          href={`/projects/${projectKey}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
        >
          <span className="font-mono">{projectKey}</span>
          <span aria-hidden="true">·</span>
          <span>{projectName}</span>
          <ExternalLink className="size-3" aria-hidden="true" />
        </Link>
        <span aria-hidden="true" className="text-default-300">
          •
        </span>
        <span>Actualizada {relativeFromNow(narrative.updated_at)}</span>
        <span aria-hidden="true" className="text-default-300">
          •
        </span>
        <span>
          {totalWorkstreams} workstream{totalWorkstreams === 1 ? "" : "s"} ·{" "}
          {totalIssues} issue{totalIssues === 1 ? "" : "s"} · {globalProgress}%
          completado
        </span>
        {totalDependencies > 0 ? (
          <>
            <span aria-hidden="true" className="text-default-300">
              •
            </span>
            <a
              href="#dependencias"
              className="font-medium hover:text-foreground hover:underline"
            >
              {totalDependencies} dependencia
              {totalDependencies === 1 ? "" : "s"}
            </a>
            {criticalDependencyCount > 0 ? (
              <a
                href="#dependencias"
                className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 hover:bg-red-200"
              >
                <AlertTriangle className="size-3" aria-hidden="true" />
                {criticalDependencyCount} en estado crítico
              </a>
            ) : null}
          </>
        ) : null}
      </div>

      {narrative.overview ? <OverviewBlock text={narrative.overview} /> : null}
    </header>
  );
}

function OverviewBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > OVERVIEW_TRUNCATE_AT;
  const display =
    !isLong || expanded ? text : `${text.slice(0, OVERVIEW_TRUNCATE_AT)}…`;

  return (
    <div className="flex flex-col gap-2">
      <p className="max-w-[70ch] whitespace-pre-line text-base leading-relaxed text-foreground group-data-[mode=presentation]/preview:text-lg">
        {display}
      </p>
      {isLong ? (
        <button
          type="button"
          data-print="hide"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-sm font-medium text-blue-700 hover:underline"
        >
          {expanded ? "Leer menos" : "Leer más"}
        </button>
      ) : null}
    </div>
  );
}
