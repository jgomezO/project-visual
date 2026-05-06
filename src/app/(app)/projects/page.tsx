import Link from "next/link";
import { Card } from "@heroui/react";
import { FileText } from "lucide-react";
import { SyncButton } from "@/components/SyncButton";
import { relativeFromNow } from "@/lib/format/relativeTime";
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
  lastSyncFinishedAt: string | null;
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

  const { data: runs, error: runsError } = await supabase
    .from("sync_runs")
    .select("finished_at")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1);
  if (runsError) throw runsError;
  const lastSyncFinishedAt = runs?.[0]?.finished_at ?? null;

  return { projects, lastSyncFinishedAt };
}

export default async function ProjectsPage() {
  const { projects, lastSyncFinishedAt } = await loadDashboard();

  if (projects.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <Card>
          <Card.Header>
            <Card.Title>Sin datos sincronizados</Card.Title>
            <Card.Description>
              No se encontró ningún proyecto en la base local. Ejecutá una
              sincronización inicial para traer proyectos e issues desde Jira.
            </Card.Description>
          </Card.Header>
          <Card.Footer>
            <SyncButton size="lg">Sincronizar ahora</SyncButton>
          </Card.Footer>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Proyectos de Jira</h1>
          <p className="mt-2 text-muted">
            {projects.length} proyecto{projects.length === 1 ? "" : "s"} ·
            Última sync: {relativeFromNow(lastSyncFinishedAt)}
          </p>
        </div>
        <SyncButton variant="outline">Resincronizar</SyncButton>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </main>
  );
}

// Stretched-link pattern: the card surface is one big click target via
// an absolute-positioned overlay <Link>, but the narratives badge is a
// second <Link> rendered AFTER the overlay (later in DOM = higher in
// the natural stacking order) and pinned with `relative z-10` so it
// reliably wins over the overlay even if a future style adds z to the
// overlay. The wrapping div carries `group` + `relative` so:
//   - absolute children anchor here (instead of to the Card root, where
//     HeroUI's own classes can fight `hover:`),
//   - hover styles propagate via `group-hover:` to the Card, the badge,
//     and any nested element that wants to react.
function ProjectCard({ project }: { project: ProjectRow }) {
  const leadName = project.lead_display_name ?? "Sin lead asignado";
  const donePct =
    project.total_issues === 0
      ? 0
      : Math.round((project.done_issues / project.total_issues) * 100);
  return (
    <div className="group relative">
      <Card className="transition group-hover:border-default-400 group-hover:shadow-md">
        <Card.Header className="pr-20">
          <Card.Title>{project.name}</Card.Title>
          <Card.Description>
            <span className="font-mono text-xs">{project.key}</span> ·{" "}
            {leadName}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-muted">Total de issues</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {project.total_issues}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">% en Done</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {donePct}%
              </dd>
            </div>
          </dl>
        </Card.Content>
      </Card>

      <Link
        href={`/projects/${project.key}`}
        aria-label={`Ver ${project.name}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      />

      {project.narratives_count > 0 ? (
        <Link
          href={`/projects/${project.key}?view=narratives`}
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-default-200 bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:border-default-400 hover:bg-default-100"
        >
          <FileText className="size-3.5" aria-hidden="true" />
          <span>
            {project.narratives_count} narrativa
            {project.narratives_count === 1 ? "" : "s"}
          </span>
        </Link>
      ) : null}
    </div>
  );
}
