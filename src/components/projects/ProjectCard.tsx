import Link from "next/link";
import { GeistMono } from "geist/font/mono";
import { ArrowUpRight, BookText } from "lucide-react";
import { ActionButton, Card, Chip } from "@/components/ui";

export interface ProjectCardData {
  id: string;
  key: string;
  name: string;
  lead_display_name: string | null;
  total_issues: number;
  done_issues: number;
  narratives_count: number;
}

// Stretched-link + group-hover pattern (extension of the iter 4g
// recipe, adapted to the new design system):
//   - Outer wrapper: `group relative` — owns the hover state and
//     anchors the absolute children.
//   - Card surface: paints, no nav semantics. Lifts via group-hover
//     shadow so the entire surface feels intentional under the cursor
//     even though the link target is a sibling, not the wrapper.
//   - Stretched link: absolute inset-0, sits last in DOM. aria-label
//     gives screen readers a real destination ("Ver <project>").
//   - Narratives chip: rendered as a child Link with `relative z-10`,
//     wins the hit-test against the stretched overlay so its own
//     route (?view=narratives) is reachable.
//   - ActionButton: purely decorative — pointer-events-none, tabIndex=-1,
//     aria-hidden so the keyboard / SR audience experiences a single
//     "Ver <project>" affordance instead of two redundant ones.
export function ProjectCard({ project }: { project: ProjectCardData }) {
  const leadName = project.lead_display_name ?? "Sin lead asignado";
  const leadInitial = (
    project.lead_display_name?.trim()[0] ?? "?"
  ).toUpperCase();
  const donePct =
    project.total_issues === 0
      ? 0
      : Math.round((project.done_issues / project.total_issues) * 100);
  const hasNarratives = project.narratives_count > 0;

  return (
    <div className="group relative">
      <Card className="transition-shadow group-hover:shadow-lg">
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700"
          >
            {leadInitial}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold text-text-primary">
              {project.name}
            </h3>
            <p className="mt-0.5 truncate text-sm text-text-secondary">
              <span className={`${GeistMono.className} text-xs`}>
                {project.key}
              </span>
              {" · Lead: "}
              {leadName}
            </p>
          </div>
        </div>

        <div className="my-4 border-t border-border" />

        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Total issues
            </dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums text-text-primary">
              {project.total_issues}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Completado
            </dt>
            <dd className="mt-1 text-3xl font-bold tabular-nums text-text-primary">
              {donePct}%
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex items-center justify-between gap-3">
          {hasNarratives ? (
            <Link
              href={`/projects/${project.key}?view=narratives`}
              className="relative z-10 inline-flex"
              aria-label={`Ver narrativas de ${project.name}`}
            >
              <Chip variant="accent">
                <BookText className="size-3.5" aria-hidden="true" />
                {project.narratives_count} narrativa
                {project.narratives_count === 1 ? "" : "s"}
              </Chip>
            </Link>
          ) : (
            <Chip variant="muted">
              <BookText className="size-3.5" aria-hidden="true" />
              Sin narrativas
            </Chip>
          )}
          <ActionButton
            aria-label={`Abrir ${project.name}`}
            tabIndex={-1}
            aria-hidden="true"
            className="pointer-events-none"
          >
            <ArrowUpRight className="size-5" aria-hidden="true" />
          </ActionButton>
        </div>
      </Card>

      <Link
        href={`/projects/${project.key}`}
        aria-label={`Ver ${project.name}`}
        className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
      />
    </div>
  );
}
