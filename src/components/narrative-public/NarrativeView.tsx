import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  IssuePublicData,
  NarrativeDerived,
} from "@/lib/narratives/derived";
import type { NarrativeWithChildren } from "@/lib/narratives/types";
import { DraftBanner } from "./DraftBanner";
import { NarrativeHeader } from "./NarrativeHeader";
import { PhaseSection } from "./PhaseSection";
import { PresentationModeToggle } from "./PresentationModeToggle";
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
      className="group/preview min-h-[100vh] bg-surface text-foreground"
    >
      {!narrative.published ? <DraftBanner /> : null}

      <div
        data-print="hide"
        className="mx-auto flex max-w-[1200px] items-center justify-between px-6 pt-4"
      >
        {mode === "normal" ? (
          <Link
            href={`/projects/${projectKey}/narratives/${narrative.id}/edit`}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Editor
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
        <PresentationModeToggle mode={mode} />
      </div>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-10 px-6 py-12 group-data-[mode=presentation]/preview:py-20">
        <NarrativeHeader
          narrative={narrative}
          projectKey={projectKey}
          projectName={projectName}
          globalProgress={derived.globalProgress}
          totalWorkstreams={derived.totalWorkstreams}
          totalIssues={derived.totalIssues}
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
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Workstreams transversales
              </h2>
              <p className="text-sm text-muted">
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

      </main>
    </div>
  );
}
