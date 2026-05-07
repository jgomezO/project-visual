"use client";

import { useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ProjectNarrative } from "@/lib/narratives/types";

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
  totalRisks: number;
  highSeverityRiskCount: number;
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
  totalRisks,
  highSeverityRiskCount,
}: Props) {
  const t = useTranslations("preview.header");
  const format = useFormatter();
  return (
    <header className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {/* Two-step clamp on the H1 in presentation mode: text-5xl on
            small viewports (mobile-shared link), text-7xl from sm+
            (the realistic target — desk monitor in a meeting). The
            `text-balance` keeps long titles wrapping cleanly. */}
        <h1 className="text-balance text-4xl font-bold tracking-tight text-text-primary group-data-[mode=presentation]/preview:text-5xl group-data-[mode=presentation]/preview:sm:text-7xl">
          {narrative.title}
        </h1>
        {narrative.subtitle ? (
          <p className="text-xl font-normal text-text-secondary group-data-[mode=presentation]/preview:text-2xl group-data-[mode=presentation]/preview:sm:text-3xl">
            {narrative.subtitle}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted group-data-[mode=presentation]/preview:text-base">
        <Link
          href={`/projects/${projectKey}`}
          target="_blank"
          rel="noreferrer"
          aria-label={t("openProjectAria")}
          className="inline-flex items-center gap-1 transition-colors hover:text-text-primary hover:underline"
        >
          <span className="font-mono">{projectKey}</span>
          <span aria-hidden="true">·</span>
          <span>{projectName}</span>
          <ExternalLink className="size-3" aria-hidden="true" />
        </Link>
        <span aria-hidden="true" className="text-text-muted/60">
          •
        </span>
        <span>
          {t("updated", {
            time: format.relativeTime(new Date(narrative.updated_at)),
          })}
        </span>
        <span aria-hidden="true" className="text-text-muted/60">
          •
        </span>
        <span>
          {t("totals", {
            workstreams: totalWorkstreams,
            issues: totalIssues,
            progress: globalProgress,
          })}
        </span>
        {totalDependencies > 0 ? (
          <>
            <span aria-hidden="true" className="text-text-muted/60">
              •
            </span>
            <a
              href="#dependencias"
              className="font-medium transition-colors hover:text-text-primary hover:underline"
            >
              {t("dependenciesLink", { count: totalDependencies })}
            </a>
            {criticalDependencyCount > 0 ? (
              <a
                href="#dependencias"
                className="inline-flex items-center gap-1 rounded-full bg-error-bg px-2 py-0.5 text-xs font-semibold text-error transition-colors hover:bg-error-bg/80"
              >
                <AlertTriangle className="size-3" aria-hidden="true" />
                {t("criticalDependencies", { count: criticalDependencyCount })}
              </a>
            ) : null}
          </>
        ) : null}
        {totalRisks > 0 ? (
          <>
            <span aria-hidden="true" className="text-text-muted/60">
              •
            </span>
            <a
              href="#riesgos"
              className="font-medium transition-colors hover:text-text-primary hover:underline"
            >
              {t("risksLink", { count: totalRisks })}
            </a>
            {highSeverityRiskCount > 0 ? (
              <a
                href="#riesgos"
                className="inline-flex items-center gap-1 rounded-full bg-error-bg px-2 py-0.5 text-xs font-semibold text-error transition-colors hover:bg-error-bg/80"
              >
                <AlertTriangle className="size-3" aria-hidden="true" />
                {t("highSeverityRisks", { count: highSeverityRiskCount })}
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
  const t = useTranslations("preview.header.overview");
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > OVERVIEW_TRUNCATE_AT;
  const display =
    !isLong || expanded ? text : `${text.slice(0, OVERVIEW_TRUNCATE_AT)}…`;

  return (
    <div className="flex flex-col gap-2">
      <p className="max-w-[70ch] whitespace-pre-line text-base leading-relaxed text-text-primary group-data-[mode=presentation]/preview:text-lg">
        {display}
      </p>
      {isLong ? (
        <button
          type="button"
          data-print="hide"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-sm font-medium text-primary-700 transition-colors hover:text-primary-800 hover:underline"
        >
          {expanded ? t("collapse") : t("expand")}
        </button>
      ) : null}
    </div>
  );
}
