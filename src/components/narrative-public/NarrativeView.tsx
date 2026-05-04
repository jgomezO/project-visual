import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type {
  IssuePublicData,
  NarrativeDerived,
} from "@/lib/narratives/derived";
import type { NarrativeWithChildren } from "@/lib/narratives/types";
import { DraftBanner } from "./DraftBanner";
import { NarrativeHeader } from "./NarrativeHeader";
import { StatusSummaryCard } from "./StatusSummaryCard";

type ViewMode = "normal" | "presentation";

interface Props {
  narrative: NarrativeWithChildren;
  projectKey: string;
  projectName: string;
  derived: NarrativeDerived;
  // Reserved for commit 4 — passed through now so the data is available
  // when WorkstreamCard learns to render an expanded issue list.
  issuesByKey: Map<string, IssuePublicData>;
  mode: ViewMode;
}

export function NarrativeView({
  narrative,
  projectKey,
  projectName,
  derived,
  mode,
}: Props) {
  return (
    <div
      data-mode={mode}
      className="group/preview min-h-[100vh] bg-surface text-foreground"
    >
      {!narrative.published ? <DraftBanner /> : null}

      {mode === "normal" ? (
        <div
          data-print="hide"
          className="mx-auto flex max-w-[1200px] items-center px-6 pt-4"
        >
          <Link
            href={`/projects/${projectKey}/narratives/${narrative.id}/edit`}
            className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Editor
          </Link>
        </div>
      ) : null}

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

        {/* Phases + workstreams ship in commits 2-4. */}
      </main>
    </div>
  );
}
