import { GeistMono } from "geist/font/mono";
import { AlertTriangle, Ban, CheckCircle2, Clock } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui";
import { Link } from "@/i18n/navigation";

export interface DashboardData {
  project_id: string | null;
  project_key: string | null;
  project_name: string | null;
  lead_display_name: string | null;
  last_synced_at: string | null;
  total: number | null;
  todo_count: number | null;
  in_progress_count: number | null;
  done_count: number | null;
  overdue_count: number | null;
  blocked_count: number | null;
}

export async function KpiHeader({ data }: { data: DashboardData }) {
  const t = await getTranslations("projectDetail");
  const format = await getFormatter();

  const total = data.total ?? 0;
  const todo = data.todo_count ?? 0;
  const inProgress = data.in_progress_count ?? 0;
  const done = data.done_count ?? 0;
  const overdue = data.overdue_count ?? 0;
  const blocked = data.blocked_count ?? 0;
  const donePct = total === 0 ? 0 : Math.round((done / total) * 100);

  const lastSyncText = data.last_synced_at
    ? t("header.lastSync", {
        time: format.relativeTime(new Date(data.last_synced_at)),
      })
    : t("header.notSynced");

  return (
    <header className="space-y-8">
      <Breadcrumb
        projectName={data.project_name ?? data.project_key ?? "—"}
      />

      <div>
        <h1 className="text-4xl font-bold tracking-tight text-text-primary">
          {data.project_name ?? t("header.untitled")}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-text-secondary">
          <span className={`${GeistMono.className} text-sm`}>
            {data.project_key}
          </span>
          {data.lead_display_name ? (
            <>
              <span aria-hidden="true" className="text-text-muted">
                ·
              </span>
              <span>
                {t("header.lead", { name: data.lead_display_name })}
              </span>
            </>
          ) : null}
          <span aria-hidden="true" className="text-text-muted">
            ·
          </span>
          <Clock className="size-4" aria-hidden="true" />
          <span>{lastSyncText}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <TotalCard
          total={total}
          todo={todo}
          inProgress={inProgress}
          done={done}
        />
        <CompletedCard pct={donePct} />
        <OverdueCard count={overdue} />
        <BlockedCard count={blocked} />
      </div>
    </header>
  );
}

async function Breadcrumb({ projectName }: { projectName: string }) {
  const t = await getTranslations("projectDetail.breadcrumb");
  return (
    <nav aria-label={t("aria")} className="flex items-center gap-2 text-sm">
      <Link
        href="/projects"
        className="text-text-secondary transition-colors hover:text-text-primary"
      >
        {t("projects")}
      </Link>
      <span aria-hidden="true" className="text-text-muted">
        /
      </span>
      <span className="font-medium text-text-primary">{projectName}</span>
    </nav>
  );
}

// Caption-style label used by every KPI card. Uppercase + tracking-wide
// + size xs + muted ink — matches the ProjectCard stat captions on
// /projects, so the two surfaces share a tipographic vocabulary.
function CardCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
      {children}
    </p>
  );
}

async function TotalCard({
  total,
  todo,
  inProgress,
  done,
}: {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
}) {
  const t = await getTranslations("projectDetail.kpis");
  const tooltip = t("totalBreakdown", { todo, inProgress, done });
  const todoPct = total === 0 ? 0 : (todo / total) * 100;
  const inProgressPct = total === 0 ? 0 : (inProgress / total) * 100;
  const donePct = total === 0 ? 0 : (done / total) * 100;

  return (
    <Card>
      <CardCaption>{t("totalIssues")}</CardCaption>
      <p className="mt-2 text-4xl font-bold tabular-nums text-text-primary">
        {total}
      </p>
      {total > 0 ? (
        <>
          <div
            title={tooltip}
            role="img"
            aria-label={tooltip}
            className="mt-4 flex h-2 w-full overflow-hidden rounded-full"
          >
            <div className="bg-cool-200" style={{ width: `${todoPct}%` }} />
            <div className="bg-info" style={{ width: `${inProgressPct}%` }} />
            <div className="bg-success" style={{ width: `${donePct}%` }} />
          </div>
          <p className="mt-2 text-xs text-text-muted">{tooltip}</p>
        </>
      ) : (
        <p className="mt-4 text-xs text-text-muted">{t("noIssuesYet")}</p>
      )}
    </Card>
  );
}

async function CompletedCard({ pct }: { pct: number }) {
  const t = await getTranslations("projectDetail.kpis");
  let colorClass = "text-success";
  if (pct < 30) colorClass = "text-error";
  else if (pct < 70) colorClass = "text-warning";
  return (
    <Card>
      <CardCaption>{t("percentCompleted")}</CardCaption>
      <p className={`mt-2 text-4xl font-bold tabular-nums ${colorClass}`}>
        {pct}%
      </p>
    </Card>
  );
}

async function OverdueCard({ count }: { count: number }) {
  const t = await getTranslations("projectDetail.kpis");
  const safe = count === 0;
  const Icon = safe ? CheckCircle2 : AlertTriangle;
  const colorClass = safe ? "text-success" : "text-error";
  return (
    <Card>
      <CardCaption>{t("overdueIssues")}</CardCaption>
      <p
        className={`mt-2 flex items-center gap-2 text-4xl font-bold tabular-nums ${colorClass}`}
      >
        <Icon className="size-6" aria-hidden="true" />
        {count}
      </p>
    </Card>
  );
}

async function BlockedCard({ count }: { count: number }) {
  const t = await getTranslations("projectDetail.kpis");
  const safe = count === 0;
  const Icon = safe ? CheckCircle2 : Ban;
  const colorClass = safe ? "text-success" : "text-error";
  return (
    <Card>
      <CardCaption>{t("blockedIssues")}</CardCaption>
      <p
        className={`mt-2 flex items-center gap-2 text-4xl font-bold tabular-nums ${colorClass}`}
      >
        <Icon className="size-6" aria-hidden="true" />
        {count}
      </p>
    </Card>
  );
}
