import type {
  NarrativeDependency,
  NarrativeRisk,
  RiskSeverity,
} from "@/lib/narratives/types";
import { SeverityBadge } from "./SeverityBadge";

// Lateral border by severity — same role as the dependency-card risk
// border, but driven by the *curated* severity (PM input) rather than
// the derived risk level.
const SEVERITY_BORDER: Record<RiskSeverity, string> = {
  low: "border-l-default-300",
  medium: "border-l-amber-500",
  high: "border-l-red-600",
};

interface Props {
  risk: NarrativeRisk;
  // Used to render the related-dependency chips with their identifier
  // and title. Anchors to #dep-{id} which DependencyCard mounts.
  dependenciesById: Map<string, NarrativeDependency>;
}

export function RiskCard({ risk, dependenciesById }: Props) {
  const severity = risk.severity as RiskSeverity;
  // Filter out dangling refs: if a related dep was deleted after the
  // risk was saved, the array still carries its UUID. Drop those at
  // render time — see CLAUDE.md "related_dependency_ids" decision.
  const relatedDeps = risk.related_dependency_ids
    .map((id) => dependenciesById.get(id))
    .filter((d): d is NarrativeDependency => d !== undefined);

  return (
    <article
      id={`risk-${risk.id}`}
      className={`flex flex-col gap-4 rounded-xl border border-default-200 border-l-4 bg-surface p-5 shadow-sm ${SEVERITY_BORDER[severity]}`}
    >
      <header className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-default-200 px-2 py-0.5 font-mono text-[11px] font-semibold text-muted">
          {risk.identifier}
        </span>
        <h3 className="flex-1 text-lg font-semibold tracking-tight text-foreground group-data-[mode=presentation]/preview:text-xl">
          {risk.title}
        </h3>
        <SeverityBadge severity={severity} />
      </header>

      {risk.description ? (
        <p className="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-foreground group-data-[mode=presentation]/preview:text-base">
          {risk.description}
        </p>
      ) : null}

      <BulletSection title="Impactos" items={risk.impacts} />
      <BulletSection title="Mitigaciones" items={risk.mitigations} />

      {relatedDeps.length > 0 ? (
        <footer className="flex flex-wrap items-center gap-2 border-t border-default-100 pt-3 text-xs text-muted">
          <span className="font-semibold uppercase tracking-wide">
            Dependencias relacionadas
          </span>
          {relatedDeps.map((dep) => (
            <a
              key={dep.id}
              href={`#dep-${dep.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-default-100 px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-default-200"
            >
              <span className="font-mono text-[10px] text-muted">
                {dep.identifier}
              </span>
              <span className="max-w-[16rem] truncate">{dep.title}</span>
            </a>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

function BulletSection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h4>
      <ul className="flex flex-col gap-1 pl-4 text-sm leading-relaxed text-foreground group-data-[mode=presentation]/preview:text-base">
        {items.map((item, idx) => (
          <li key={idx} className="list-disc whitespace-pre-line">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
