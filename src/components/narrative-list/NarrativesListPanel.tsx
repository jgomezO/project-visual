import { FileText } from "lucide-react";
import { NarrativeCard } from "./NarrativeCard";
import { NewNarrativeButton } from "./NewNarrativeButton";
import { getNarrativesByProject } from "@/lib/narratives/queries";

interface Props {
  projectKey: string;
  projectId: string;
  // Display name shown in the heading ("Narrativas de <name>"). Pass
  // null to use the generic "Narrativas del proyecto" — appropriate
  // when the panel is embedded under a UI surface that already shows
  // the project name (e.g. the /projects/[key] tab, where the
  // KpiHeader sits above with its own h1).
  projectName: string | null;
}

// Reusable surface for "list of narratives + create CTA + empty state".
// Server Component that fetches its own data; renders inside both the
// /projects/[key]/narratives standalone page (today) and the new
// /projects/[key]?view=narratives tab (iter 4g).
export async function NarrativesListPanel({
  projectKey,
  projectId,
  projectName,
}: Props) {
  const narratives = await getNarrativesByProject(projectKey);

  const heading = projectName
    ? `Narrativas de ${projectName}`
    : "Narrativas del proyecto";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{heading}</h2>
        <NewNarrativeButton projectKey={projectKey} projectId={projectId} />
      </header>

      {narratives.length === 0 ? (
        <EmptyState projectKey={projectKey} projectId={projectId} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {narratives.map((n) => (
            <li key={n.id}>
              <NarrativeCard projectKey={projectKey} narrative={n} />
            </li>
          ))}
        </ul>
      )}
    </div>
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
      <h3 className="text-lg font-semibold">
        Aún no hay narrativas para este proyecto
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Las narrativas te ayudan a presentar el plan de un proyecto a
        audiencias no técnicas. Cada narrativa puede tener fases,
        workstreams, dependencias y riesgos, todo conectado con issues
        reales de Jira.
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
