import { Clock, FolderOpen } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { SyncButton } from "@/components/SyncButton";
import { ProjectCard } from "@/components/projects/ProjectCard";
import {
  SyncStatusBadge,
  type LastRun,
} from "@/components/projects/SyncStatusBadge";
import { Card, CurvedLines } from "@/components/ui";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ProjectRow {
  id: string;
  key: string;
  name: string;
  lead_display_name: string | null;
  last_synced_at: string | null;
  total_issues: number;
  done_issues: number;
  narratives_count: number;
}

interface DashboardData {
  projects: ProjectRow[];
  // Last clean sync — drives the Hero subtitle "Last sync: 1 day ago".
  // NULL when no successful run has happened yet.
  lastSyncFinishedAt: string | null;
  // Last completed run, regardless of status (excluding 'running' to
  // dodge stuck rows). Drives the SyncStatusBadge — a partial / failed
  // run AFTER the last successful one wants to surface even though the
  // Hero subtitle still happily reports the older success time.
  lastRun: LastRun | null;
}

async function loadDashboard(): Promise<DashboardData> {
  const supabase = await getServerSupabase();

  // `project_stats` is a SQL view that aggregates issue counts per
  // project server-side. Replaced an in-app group-by over a single
  // IN() query — PostgREST caps responses at 1000 rows, which truncated
  // the aggregation once total issues across projects went past that.
  // narratives_count was appended in iter 4g.
  const { data: rawProjects, error: projError } = await supabase
    .from("project_stats")
    .select("*")
    .order("name", { ascending: true });
  if (projError) throw projError;
  const projects: ProjectRow[] = (rawProjects ?? []).map((row) => ({
    id: row.id ?? "",
    key: row.key ?? "",
    name: row.name ?? "",
    lead_display_name: row.lead_display_name,
    last_synced_at: row.last_synced_at,
    total_issues: row.total_issues ?? 0,
    done_issues: row.done_issues ?? 0,
    narratives_count: row.narratives_count ?? 0,
  }));

  // Two queries against sync_runs serve different UI slots:
  //   - lastSuccessfulSync: pins the Hero subtitle to "the last time
  //     everything was clean". Stable timestamp, not affected by a
  //     more-recent partial / failed run.
  //   - lastRun: the absolute most recent finished run (any status).
  //     Drives the badge — a partial run today should surface even
  //     when yesterday's full success is still the most recent OK.
  // Two separate queries (vs. one fetched-and-massaged) because each
  // composes its own ORDER BY + LIMIT 1 on the same indexed
  // `finished_at`; PostgREST can't express "give me the latest of each
  // status" in one round-trip without a SQL function.
  const [
    { data: successRuns, error: successRunsError },
    { data: lastRunRows, error: lastRunError },
  ] = await Promise.all([
    supabase
      .from("sync_runs")
      .select("finished_at")
      .eq("status", "success")
      .order("finished_at", { ascending: false })
      .limit(1),
    supabase
      .from("sync_runs")
      .select(
        "id, status, triggered_by, finished_at, failed_projects, error_message",
      )
      .in("status", ["success", "partial", "failed"])
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(1),
  ]);
  if (successRunsError) throw successRunsError;
  if (lastRunError) throw lastRunError;
  const lastSyncFinishedAt = successRuns?.[0]?.finished_at ?? null;

  const rawLastRun = lastRunRows?.[0] ?? null;
  const lastRun: LastRun | null = rawLastRun
    ? {
        id: rawLastRun.id,
        // CHECK constraint guarantees one of these four; the cast is
        // safe but the generated types still surface `string`.
        status: rawLastRun.status as "success" | "partial" | "failed",
        triggeredBy: rawLastRun.triggered_by as "manual" | "cron",
        finishedAt: rawLastRun.finished_at,
        failedProjects:
          (rawLastRun.failed_projects as
            | { projectKey: string; error: string }[]
            | null) ?? null,
        errorMessage: rawLastRun.error_message,
      }
    : null;

  return { projects, lastSyncFinishedAt, lastRun };
}

export default async function ProjectsPage() {
  const { projects, lastSyncFinishedAt, lastRun } = await loadDashboard();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Hero
        projectCount={projects.length}
        lastSyncFinishedAt={lastSyncFinishedAt}
        lastRun={lastRun}
      />

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </main>
  );
}

// Hero header — page title + subtitle + sync CTA. Sits inside a
// rounded warm-cream block; CurvedLines rides the background at very
// low opacity for personality without distracting from the title.
// On small screens the curves hide (sm:block) — they're a wide-format
// flourish, not load-bearing for understanding the page.
//
// iter 5 (i18n): subtitle uses an ICU plural for project count and an
// interpolated `{time}` placeholder. The time string is pre-formatted
// via getFormatter().relativeTime() (locale-aware: "2 hours ago" /
// "hace 2 horas") or falls back to the translated "never" / "nunca"
// when no successful sync has run yet.
async function Hero({
  projectCount,
  lastSyncFinishedAt,
  lastRun,
}: {
  projectCount: number;
  lastSyncFinishedAt: string | null;
  lastRun: LastRun | null;
}) {
  const t = await getTranslations("projects");
  const format = await getFormatter();
  const time = lastSyncFinishedAt
    ? format.relativeTime(new Date(lastSyncFinishedAt))
    : t("lastSyncNever");

  return (
    <section className="relative mb-8 overflow-hidden rounded-3xl bg-warm-50 px-6 py-12 sm:px-10">
      <CurvedLines className="absolute inset-0 hidden text-primary-500 sm:block" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-text-primary">
            {t("title")}
          </h1>
          <p className="mt-3 inline-flex items-center gap-2 text-base text-text-secondary">
            <Clock className="size-4" aria-hidden="true" />
            <span>{t("subtitle", { count: projectCount, time })}</span>
          </p>
          {/* Badge renders inline below the subtitle when the most
              recent finished run was partial or failed. Returns null
              for clean runs / no runs yet, so the layout stays
              identical in the happy path. */}
          <div className="mt-3">
            <SyncStatusBadge lastRun={lastRun} />
          </div>
        </div>
        <SyncButton variant="secondary" mode="idle" />
      </div>
    </section>
  );
}

async function EmptyState() {
  const t = await getTranslations("projects.emptyState");

  return (
    <Card variant="hero" className="mx-auto max-w-xl text-center">
      <FolderOpen
        className="mx-auto size-14 text-text-muted"
        aria-hidden="true"
      />
      <h2 className="mt-4 text-2xl font-semibold text-text-primary">
        {t("title")}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-base text-text-secondary">
        {t("description")}
      </p>
      <div className="mt-6 flex justify-center">
        <SyncButton size="lg" mode="initial" />
      </div>
    </Card>
  );
}
