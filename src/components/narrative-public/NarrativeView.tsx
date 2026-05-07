import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  IssuePublicData,
  NarrativeDerived,
} from "@/lib/narratives/derived";
import type { NarrativeWithChildren } from "@/lib/narratives/types";
import { NarrativePattern } from "@/components/ui/Decorative";
import { DependenciesSection } from "./DependenciesSection";
import { DraftBanner } from "./DraftBanner";
import { NarrativeHeader } from "./NarrativeHeader";
import { PhaseSection } from "./PhaseSection";
import { PresentationModeToggle } from "./PresentationModeToggle";
import { PreviewFooter } from "./PreviewFooter";
import { RisksSection } from "./RisksSection";
import { StatusSummaryCard } from "./StatusSummaryCard";
import { WorkstreamCard } from "./WorkstreamCard";

type ViewMode = "normal" | "presentation";

interface Props {
  narrative: NarrativeWithChildren;
  projectKey: string;
  projectName: string;
  derived: NarrativeDerived;
  issuesByKey: Map<string, IssuePublicData>;
  mode: ViewMode;
}

export function NarrativeView({
  narrative,
  projectKey,
  projectName,
  derived,
  issuesByKey,
  mode,
}: Props) {
  return (
    <div
      data-mode={mode}
      data-preview="true"
      className="group/preview relative isolate min-h-[100vh] overflow-hidden bg-surface text-text-primary"
    >
      <div
        data-print="hide"
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 -z-10 h-[500px] w-1/2 sm:w-[55%]"
      >
        <NarrativePattern className="text-primary-500 opacity-[0.06] group-data-[mode=presentation]/preview:opacity-[0.04]" />
      </div>

      {!narrative.published ? <DraftBanner /> : null}

      <div
        data-print="hide"
        className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6"
      >
        <span className="text-sm font-medium tracking-wide text-text-muted">
          PRISM
        </span>
        <div className="flex items-center gap-4">
          {mode === "normal" ? (
            <Link
              href={`/projects/${projectKey}/narratives/${narrative.id}/edit`}
              className="inline-flex items-center gap-1 text-sm text-text-muted transition-colors hover:text-text-primary"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Editor
            </Link>
          ) : null}
          <PresentationModeToggle mode={mode} />
        </div>
      </div>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-12 group-data-[mode=presentation]/preview:py-20">
        <NarrativeHeader
          narrative={narrative}
          projectKey={projectKey}
          projectName={projectName}
          globalProgress={derived.globalProgress}
          totalWorkstreams={derived.totalWorkstreams}
          totalIssues={derived.totalIssues}
          totalDependencies={narrative.dependencies.length}
          criticalDependencyCount={derived.criticalDependencyCount}
          totalRisks={narrative.risks.length}
          highSeverityRiskCount={
            narrative.risks.filter((r) => r.severity === "high").length
          }
        />

        {narrative.status_summary ? (
          <StatusSummaryCard text={narrative.status_summary} />
        ) : null}

        {narrative.phases.length > 0 ? (
          <div className="flex flex-col gap-6">
            {narrative.phases.map((phase, i) => {
              const phaseDerived = derived.perPhase.get(phase.id);
              if (!phaseDerived) return null;
              return (
                <PhaseSection
                  key={phase.id}
                  phase={phase}
                  derived={phaseDerived}
                  workstreamDerived={derived.perWorkstream}
                  issuesByKey={issuesByKey}
                  index={i}
                />
              );
            })}
          </div>
        ) : null}

        {narrative.orphan_workstreams.length > 0 ? (
          <section className="flex flex-col gap-3">
            <header className="flex flex-col gap-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Workstreams transversales
              </h2>
              <p className="text-sm text-text-muted">
                No pertenecen a ninguna fase específica.
              </p>
            </header>
            <div className="flex flex-col gap-3">
              {narrative.orphan_workstreams.map((ws) => {
                const d = derived.perWorkstream.get(ws.id);
                if (!d) return null;
                return (
                  <WorkstreamCard
                    key={ws.id}
                    workstream={ws}
                    derived={d}
                    issuesByKey={issuesByKey}
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        <DependenciesSection
          tree={narrative}
          derived={derived}
          issuesByKey={issuesByKey}
        />

        <RisksSection tree={narrative} />
      </main>

      <PreviewFooter />
    </div>
  );
}
