import type { NarrativeWithChildren } from "@/lib/narratives/types";
import { RiskCard } from "./RiskCard";

interface Props {
  tree: NarrativeWithChildren;
}

/**
 * Public read-only risks section. Mounted under the `#riesgos` anchor
 * so the header summary in NarrativeHeader can scroll-link directly.
 * Omitted entirely when there are zero risks — same pattern as
 * DependenciesSection.
 */
export function RisksSection({ tree }: Props) {
  if (tree.risks.length === 0) return null;

  // Build the dep id → entity map once instead of per-card.
  const dependenciesById = new Map(
    tree.dependencies.map((d) => [d.id, d] as const),
  );

  return (
    <section
      id="riesgos"
      aria-labelledby="risks-heading"
      className="flex flex-col gap-4 scroll-mt-20"
    >
      <header className="flex flex-col gap-1">
        <h2
          id="risks-heading"
          className="text-2xl font-semibold tracking-tight text-text-primary group-data-[mode=presentation]/preview:text-3xl"
        >
          Riesgos del proyecto
        </h2>
        {tree.risks_section_subtitle ? (
          <p className="max-w-[70ch] text-sm text-text-muted">
            {tree.risks_section_subtitle}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-4">
        {tree.risks.map((risk) => (
          <RiskCard
            key={risk.id}
            risk={risk}
            dependenciesById={dependenciesById}
          />
        ))}
      </div>
    </section>
  );
}
