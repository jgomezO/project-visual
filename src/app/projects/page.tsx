import { Card } from "@heroui/react";
import { JiraClient } from "@/lib/jira/client";
import type { ProjectWithStats } from "@/lib/jira/types";

export const dynamic = "force-dynamic";

async function getProjectsWithStats(): Promise<ProjectWithStats[]> {
  const client = new JiraClient();
  const projects = await client.listProjects();
  return Promise.all(
    projects.map(async (project) => ({
      ...project,
      stats: await client.getProjectStats(project.key),
    })),
  );
}

export default async function ProjectsPage() {
  const projects = await getProjectsWithStats();

  return (
    <main className="mx-auto max-w-6xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Proyectos de Jira</h1>
        <p className="mt-2 text-muted">
          {projects.length} proyecto{projects.length === 1 ? "" : "s"}
        </p>
      </header>

      {projects.length === 0 ? (
        <Card variant="transparent">
          <Card.Header>
            <Card.Title>Sin proyectos</Card.Title>
            <Card.Description>
              No se encontraron proyectos accesibles. Si configuraste
              JIRA_PROJECT_KEYS, verificá que las keys existan en tu Jira.
            </Card.Description>
          </Card.Header>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </main>
  );
}

function ProjectCard({ project }: { project: ProjectWithStats }) {
  const leadName = project.lead?.displayName ?? "Sin lead asignado";
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
              {project.stats.total}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">% en Done</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {project.stats.donePct}%
            </dd>
          </div>
        </dl>
      </Card.Content>
    </Card>
  );
}
