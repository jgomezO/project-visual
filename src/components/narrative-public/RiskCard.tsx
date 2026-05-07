import type {
  NarrativeDependency,
  NarrativeRisk,
  RiskSeverity,
} from "@/lib/narratives/types";
import { SeverityBadge } from "./SeverityBadge";

// Lateral border by severity — same role as the dependency-card risk
// border, but driven by the *curated* severity (PM input) rather than
// the derived risk level. Prism palette (R4): low → muted, medium →
// warning, high → error. Severity is 3-bucket so we don't need the
// warm-700 escalation step that DependencyCard uses for "high".
const SEVERITY_BORDER: Record<RiskSeverity, string> = {
  low: "border-l-text-muted/40",
  medium: "border-l-warning",
  high: "border-l-error",
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
      className={`flex flex-col gap-4 rounded-xl border border-border border-l-4 bg-surface p-5 shadow-sm ${SEVERITY_BORDER[severity]}`}
    >
      <header className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-warm-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-text-muted">
          {risk.identifier}
        </span>
        <h3 className="flex-1 text-lg font-semibold tracking-tight text-text-primary group-data-[mode=presentation]/preview:text-xl">
          {risk.title}
        </h3>
        <SeverityBadge severity={severity} />
      </header>

      {risk.description ? (
        <p className="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-text-primary group-data-[mode=presentation]/preview:text-base">
          {risk.description}
        </p>
      ) : null}

      {/* 2-col grid on sm+ so impacts and mitigations sit side-by-side
          on roomy layouts and stack on mobile. If one bucket is empty,
          BulletSection returns null and the grid collapses to one
          column gracefully. */}
      {(risk.impacts.length > 0 || risk.mitigations.length > 0) ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <BulletSection title="Impactos" items={risk.impacts} tone="impact" />
          <BulletSection
            title="Mitigaciones"
            items={risk.mitigations}
            tone="mitigation"
          />
        </div>
      ) : null}

      {relatedDeps.length > 0 ? (
        <footer className="flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-text-muted">
          <span className="font-semibold uppercase tracking-wide">
            Dependencias relacionadas
          </span>
          {relatedDeps.map((dep) => (
            <a
              key={dep.id}
              href={`#dep-${dep.id}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-medium text-text-primary transition-colors hover:bg-warm-200"
            >
              <span className="font-mono text-[10px] text-text-muted">
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

// Boxed subsection for impacts / mitigations. Both share the warm
// neutral wash (bg-warm-50/60) so the card doesn't feel loud when both
// are filled. Semantic distinction comes from the tone-coloured caption
// + bullet markers — impact in error red, mitigation in success green.
function BulletSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "impact" | "mitigation";
}) {
  if (items.length === 0) return null;
  const captionColor = tone === "impact" ? "text-error" : "text-success";
  const markerColor =
    tone === "impact" ? "marker:text-error" : "marker:text-success";
  return (
    <section className="flex flex-col gap-2 rounded-lg bg-warm-50/60 p-4">
      <h4
        className={`text-xs font-semibold uppercase tracking-wide ${captionColor}`}
      >
        {title}
      </h4>
      <ul
        className={`flex flex-col gap-1 pl-4 text-sm leading-relaxed text-text-primary ${markerColor} group-data-[mode=presentation]/preview:text-base`}
      >
        {items.map((item, idx) => (
          <li key={idx} className="list-disc whitespace-pre-line">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
