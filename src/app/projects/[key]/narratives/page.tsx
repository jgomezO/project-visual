import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { NarrativeCard } from "@/components/narrative-list/NarrativeCard";
import { NewNarrativeButton } from "@/components/narrative-list/NewNarrativeButton";
import { UserMenu } from "@/components/UserMenu";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getNarrativesByProject } from "@/lib/narratives/queries";
import { getAnonSupabase } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string }>;
}

export default async function NarrativesListPage({ params }: PageProps) {
  const { key } = await params;

  // Validate the project exists before listing — the URL might be wrong.
  const supabase = getAnonSupabase();
  const [{ data: project, error: projectError }, currentUser] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, key, name")
        .eq("key", key)
        .maybeSingle(),
      getCurrentUser(),
    ]);
  if (projectError) throw projectError;
  if (!project) notFound();

  const narratives = await getNarrativesByProject(key);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb projectKey={key} projectName={project.name ?? key} />
        {currentUser ? (
          <UserMenu
            email={currentUser.email}
            displayName={currentUser.displayName}
          />
        ) : null}
      </div>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          Narrativas de {project.name ?? key}
        </h1>
        <NewNarrativeButton projectKey={key} projectId={project.id} />
      </header>

      {narratives.length === 0 ? (
        <EmptyState projectKey={key} projectId={project.id} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {narratives.map((n) => (
            <li key={n.id}>
              <NarrativeCard projectKey={key} narrative={n} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Breadcrumb({
  projectKey,
  projectName,
}: {
  projectKey: string;
  projectName: string;
}) {
  return (
    <nav className="flex items-center gap-2 text-sm text-muted">
      <Link href="/projects" className="hover:underline">
        Proyectos
      </Link>
      <span aria-hidden="true">/</span>
      <Link href={`/projects/${projectKey}`} className="hover:underline">
        {projectName}
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-foreground">Narrativas</span>
    </nav>
  );
}

function EmptyState({
  projectKey,
  projectId,
}: {
  projectKey: string;
  projectId: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-default-300 p-12 text-center">
      <FileText
        className="mx-auto mb-3 size-12 text-muted"
        aria-hidden="true"
      />
      <h2 className="text-lg font-semibold">
        Aún no hay narrativas para este proyecto
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Las narrativas te ayudan a presentar el plan de un proyecto a
        audiencias no técnicas. Cada narrativa puede tener fases,
        workstreams, y conectarse con issues reales de Jira.
      </p>
      <div className="mt-5 flex justify-center">
        <NewNarrativeButton
          projectKey={projectKey}
          projectId={projectId}
          ctaLabel="Crear primera narrativa"
        />
      </div>
    </div>
  );
}
