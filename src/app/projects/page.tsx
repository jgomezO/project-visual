import Link from "next/link";
import { Card } from "@heroui/react";
import { SyncButton } from "@/components/SyncButton";
import { relativeFromNow } from "@/lib/format/relativeTime";
import { getAnonSupabase } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

interface ProjectRow {
  id: string;
  key: string;
  name: string;
  lead_display_name: string | null;
  last_synced_at: string | null;
  total_issues: number;
  done_issues: number;
}

interface DashboardData {
  projects: ProjectRow[];
  lastSyncFinishedAt: string | null;
}

async function loadDashboard(): Promise<DashboardData> {
  const supabase = getAnonSupabase();

  const { data: rawProjects, error: projError } = await supabase
    .from("projects")
    .select("id, key, name, lead_display_name, last_synced_at")
    .order("name", { ascending: true });
  if (projError) throw projError;
  const projects = rawProjects ?? [];

  const totalsByProject = new Map<string, { total: number; done: number }>();
  if (projects.length > 0) {
    const projectIds = projects.map((p) => p.id);
    const { data: issues, error: issuesError } = await supabase
      .from("issues")
      .select("project_id, status_category")
      .in("project_id", projectIds);
    if (issuesError) throw issuesError;
    for (const i of issues ?? []) {
      const t = totalsByProject.get(i.project_id) ?? { total: 0, done: 0 };
      t.total += 1;
      if (i.status_category === "Done") t.done += 1;
      totalsByProject.set(i.project_id, t);
    }
  }

  const projectsWithStats: ProjectRow[] = projects.map((p) => {
    const t = totalsByProject.get(p.id) ?? { total: 0, done: 0 };
    return {
      ...p,
      total_issues: t.total,
      done_issues: t.done,
    };
  });

  const { data: runs, error: runsError } = await supabase
    .from("sync_runs")
    .select("finished_at")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1);
  if (runsError) throw runsError;
  const lastSyncFinishedAt = runs?.[0]?.finished_at ?? null;

  return { projects: projectsWithStats, lastSyncFinishedAt };
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
          <Link
            key={project.id}
            href={`/projects/${project.key}`}
            className="block transition-opacity hover:opacity-80"
          >
            <ProjectCard project={project} />
          </Link>
        ))}
      </div>
    </main>
  );
}

function ProjectCard({ project }: { project: ProjectRow }) {
  const leadName = project.lead_display_name ?? "Sin lead asignado";
  const donePct =
    project.total_issues === 0
      ? 0
      : Math.round((project.done_issues / project.total_issues) * 100);
  return (
    <Card>
      <Card.Header>
        <Card.Title>{project.name}</Card.Title>
        <Card.Description>
          <span className="font-mono text-xs">{project.key}</span> · {leadName}
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
            <dd className="text-2xl font-semibold tabular-nums">{donePct}%</dd>
          </div>
        </dl>
      </Card.Content>
    </Card>
  );
}
