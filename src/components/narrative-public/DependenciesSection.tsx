import type {
  IssuePublicData,
  NarrativeDerived,
} from "@/lib/narratives/derived";
import type { NarrativeWithChildren } from "@/lib/narratives/types";
import { DependencyCard } from "./DependencyCard";

interface Props {
  tree: NarrativeWithChildren;
  derived: NarrativeDerived;
  issuesByKey: Map<string, IssuePublicData>;
}

/**
 * Public read-only dependencies section. Mounted under the
 * `#dependencias` anchor so the header summary in NarrativeHeader can
 * scroll-link directly. Omitted entirely when there are zero
 * dependencies — absence is the information.
 */
export function DependenciesSection({ tree, derived, issuesByKey }: Props) {
  if (tree.dependencies.length === 0) return null;

  return (
    <section
      id="dependencias"
      aria-labelledby="dependencies-heading"
      className="flex flex-col gap-4 scroll-mt-20"
    >
      <header className="flex flex-col gap-1">
        <h2
          id="dependencies-heading"
          className="text-2xl font-semibold tracking-tight text-foreground group-data-[mode=presentation]/preview:text-3xl"
        >
          Dependencias del proyecto
        </h2>
        <p className="max-w-[70ch] text-sm text-muted">
          Compromisos cross-team que condicionan la entrega de este proyecto.
          Las fechas y el estado son curados por el PM, no derivados de Jira.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {tree.dependencies.map((dep) => {
          const d = derived.perDependency.get(dep.id);
          if (!d) return null;
          return (
            <DependencyCard
              key={dep.id}
              dependency={dep}
              derived={d}
              tree={tree}
              issuesByKey={issuesByKey}
            />
          );
        })}
      </div>
    </section>
  );
}
