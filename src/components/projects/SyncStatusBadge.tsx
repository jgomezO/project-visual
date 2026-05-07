"use client";

import { Popover } from "@heroui/react";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

// Shape lifted from the loader so we can pass it raw across the
// server/client boundary. Mirrors `sync_runs` row plus the JSONB array
// already parsed by Postgres.
export interface LastRun {
  id: number;
  status: "success" | "partial" | "failed";
  triggeredBy: "manual" | "cron";
  finishedAt: string | null;
  failedProjects: { projectKey: string; error: string }[] | null;
  errorMessage: string | null;
}

interface Props {
  lastRun: LastRun | null;
}

// Badge for the projects Hero. Surfaces the LAST sync run's status —
// independent from "Last successful sync: hace 1 día" in the Hero
// subtitle, which only tracks the most recent CLEAN run.
//
// Renders nothing when:
//   - no run yet (lastRun === null)
//   - last run was a clean success (status === 'success')
//
// Otherwise: a clickable chip with AlertTriangle + label. Click opens
// a HeroUI Popover with run-level details (summary, run id, trigger
// source, per-project errors when status === 'partial').
//
// "use client" because the popover ships interactivity. Consumed by
// the projects page Hero (a Server Component); the boundary lives at
// the import site.
export function SyncStatusBadge({ lastRun }: Props) {
  const t = useTranslations("projects.syncBadge");

  if (!lastRun || lastRun.status === "success") return null;

  const isPartial = lastRun.status === "partial";
  const failedCount = lastRun.failedProjects?.length ?? 0;

  // Color tokens per status:
  //   - partial → warning (yellow): some progress, attention needed
  //   - failed  → error (red): nothing succeeded, immediate signal
  const chipClass = isPartial
    ? "bg-warning-bg text-warm-700 hover:bg-warning-bg/80"
    : "bg-error-bg text-error hover:bg-error-bg/80";

  const label = isPartial ? t("partial.label") : t("failed.label");
  const summary = isPartial
    ? t("partial.summary", { count: failedCount })
    : t("failed.summary");
  const ariaLabel = isPartial
    ? t("ariaTrigger.partial")
    : t("ariaTrigger.failed");

  return (
    <Popover>
      <button
        type="button"
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${chipClass}`}
      >
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        <span>{label}</span>
        <span aria-hidden="true" className="opacity-70">
          ·
        </span>
        <span>{summary}</span>
      </button>
      <Popover.Content className="max-w-md">
        <Popover.Dialog>
          <Popover.Heading>{t("popover.heading")}</Popover.Heading>
          <div className="mt-3 flex flex-col gap-3 text-sm">
            <SummaryRow
              label={t("popover.summaryLabel")}
              value={
                isPartial
                  ? t("partial.summary", { count: failedCount })
                  : t("failed.summary")
              }
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
              <span>{t("popover.runIdLabel", { id: lastRun.id })}</span>
              <span aria-hidden="true">·</span>
              <span>
                {lastRun.triggeredBy === "cron"
                  ? t("popover.triggerCron")
                  : t("popover.triggerManual")}
              </span>
            </div>
            {lastRun.failedProjects && lastRun.failedProjects.length > 0 ? (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t("popover.affectedProjects")}
                </h4>
                <ul className="flex flex-col gap-2">
                  {lastRun.failedProjects.map((fp) => (
                    <li
                      key={fp.projectKey}
                      className="flex flex-col gap-0.5 rounded-md bg-warm-50 px-2 py-1.5"
                    >
                      <span className="font-mono text-xs font-semibold text-text-primary">
                        {fp.projectKey}
                      </span>
                      <span className="text-xs text-text-secondary">
                        {fp.error}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : lastRun.errorMessage ? (
              // Top-level abort case: pre-loop failure (no per-project
              // detail). Surface error_message as the only signal.
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <p className="text-xs text-text-secondary">
                  {lastRun.errorMessage}
                </p>
              </div>
            ) : null}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}:
      </span>
      <span className="text-text-primary">{value}</span>
    </div>
  );
}
