import Link from "next/link";
import { notFound } from "next/navigation";
import { NarrativesListPanel } from "@/components/narrative-list/NarrativesListPanel";
import { UserMenu } from "@/components/UserMenu";
import { getCurrentUser } from "@/lib/auth/get-current-user";
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

      <NarrativesListPanel
        projectKey={key}
        projectId={project.id}
        projectName={project.name ?? key}
      />
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
