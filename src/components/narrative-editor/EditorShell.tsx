"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { ExternalLink, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  createPhaseAction,
  createWorkstreamAction,
  publishNarrativeAction,
} from "@/app/actions/narratives";
import { Button, Card } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import type {
  NarrativeDependency,
  NarrativePhase,
  NarrativePhaseWithWorkstreams,
  NarrativeRisk,
  NarrativeWithChildren,
  NarrativeWorkstream,
  ProjectNarrative,
} from "@/lib/narratives/types";
import { ActiveFormPanel } from "./ActiveFormPanel";
import { AutosaveIndicator } from "./AutosaveIndicator";
import type { FormHandle } from "./NarrativeForm";
import { StructureSidebar } from "./StructureSidebar";
import type { SaveState } from "./useAutoSave";

export type SelectedNode =
  | { kind: "narrative" }
  | { kind: "phase"; id: string }
  | { kind: "workstream"; id: string }
  | { kind: "dependencies" } // the Dependencies group node (list panel)
  | { kind: "dependency"; id: string }
  | { kind: "risks" } // the Risks group node (list panel)
  | { kind: "risk"; id: string };

const NARRATIVE_NODE: SelectedNode = { kind: "narrative" };

export function EditorShell({
  projectKey,
  projectName,
  initialNarrative,
}: {
  projectKey: string;
  projectName: string;
  initialNarrative: NarrativeWithChildren;
}) {
  const t = useTranslations("narratives.editor");
  const tSidebar = useTranslations("narratives.editor.sidebar");
  const [tree, setTree] = useState<NarrativeWithChildren>(initialNarrative);
  const [selected, setSelected] = useState<SelectedNode>(NARRATIVE_NODE);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Bootstrapping pending state — covers the create-phase /
  // create-orphan-workstream calls fired from the EmptyNarrativeState.
  // Independent from StructureSidebar's internal pending state because
  // those two surfaces don't share component scope.
  const [bootstrapping, startBootstrap] = useTransition();
  const formRef = useRef<FormHandle | null>(null);

  // Wrap the form's onSaveStateChange so we also capture lastSavedAt /
  // errorMessage. We don't have those directly from the callback, so we
  // mirror enough state in the shell to drive the indicator UI. The
  // indicator reads savedAt/saveError; when state goes "saved" we stamp
  // the time, when it goes "error" we keep the previous savedAt.
  const handleSaveStateChange = useCallback((next: SaveState) => {
    setSaveState(next);
    if (next === "saved") {
      setSavedAt(Date.now());
      setSaveError(null);
    } else if (next === "idle") {
      setSaveError(null);
    }
  }, []);

  function handleNarrativePatched(next: ProjectNarrative): void {
    setTree((prev) => ({ ...prev, ...next }));
  }

  function handlePhaseListChanged(
    next: NarrativePhaseWithWorkstreams[],
  ): void {
    setTree((prev) => ({ ...prev, phases: next }));
  }

  function handleOrphansChanged(next: NarrativeWorkstream[]): void {
    setTree((prev) => ({ ...prev, orphan_workstreams: next }));
  }

  function handlePhasePatched(next: NarrativePhase): void {
    setTree((prev) => ({
      ...prev,
      phases: prev.phases.map((p) =>
        p.id === next.id ? { ...p, ...next } : p,
      ),
    }));
  }

  function handleWorkstreamPatched(next: NarrativeWorkstream): void {
    setTree((prev) => {
      const phases = prev.phases.map((p) => ({
        ...p,
        workstreams: p.workstreams.map((w) =>
          w.id === next.id ? next : w,
        ),
      }));
      const orphans = prev.orphan_workstreams.map((w) =>
        w.id === next.id ? next : w,
      );
      return { ...prev, phases, orphan_workstreams: orphans };
    });
  }

  function handleDependencyListChanged(next: NarrativeDependency[]): void {
    setTree((prev) => ({ ...prev, dependencies: next }));
  }

  function handleDependencyPatched(next: NarrativeDependency): void {
    setTree((prev) => ({
      ...prev,
      dependencies: prev.dependencies.map((d) =>
        d.id === next.id ? next : d,
      ),
    }));
  }

  function handleRiskListChanged(next: NarrativeRisk[]): void {
    setTree((prev) => ({ ...prev, risks: next }));
  }

  function handleRiskPatched(next: NarrativeRisk): void {
    setTree((prev) => ({
      ...prev,
      risks: prev.risks.map((r) => (r.id === next.id ? next : r)),
    }));
  }

  // Bootstrapping CTAs for the empty-narrative state. Same Server
  // Actions the StructureSidebar's bottom CTAs call, but lifted here
  // so the empty state in the main panel can fire them too without
  // duplicating logic.
  function addPhase(): void {
    startBootstrap(async () => {
      try {
        const created = await createPhaseAction({
          narrative_id: tree.id,
          order_index: tree.phases.length,
          name: tSidebar("defaults.newPhase"),
          status: "upcoming",
        });
        setTree((prev) => ({
          ...prev,
          phases: [...prev.phases, { ...created, workstreams: [] }],
        }));
        setSelected({ kind: "phase", id: created.id });
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : t("errors.createPhase");
        window.alert(msg);
      }
    });
  }

  function addOrphanWorkstream(): void {
    startBootstrap(async () => {
      try {
        const created = await createWorkstreamAction({
          narrative_id: tree.id,
          phase_id: null,
          order_index: tree.orphan_workstreams.length,
          name: tSidebar("defaults.newWorkstream"),
        });
        setTree((prev) => ({
          ...prev,
          orphan_workstreams: [...prev.orphan_workstreams, created],
        }));
        setSelected({ kind: "workstream", id: created.id });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : t("errors.createWorkstream");
        window.alert(msg);
      }
    });
  }

  // Selection guard: flush the active form before changing selection. If
  // the flush fails (validation error or server error), keep the current
  // selection so the user can fix the field. The indicator stays in
  // 'error' state — they retry via Reintentar.
  const tryChangeSelection = useCallback(
    async (next: SelectedNode): Promise<void> => {
      if (formRef.current) {
        const result = await formRef.current.flush();
        if (!result.ok) {
          setSaveError(t("selectionFlushFailed"));
          return;
        }
      }
      setSelected(next);
    },
    [t],
  );

  return (
    <>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6 py-12 md:hidden">
        <Card variant="hero" className="max-w-md text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-warm-100">
            <Monitor className="size-8 text-text-muted" aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-text-primary">
            {t("mobileFallback.title")}
          </h1>
          <p className="mx-auto mt-2 text-base text-text-secondary">
            {t("mobileFallback.body")}
          </p>
          <div className="mt-6">
            <Link
              href={`/projects/${projectKey}?view=narratives`}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-warm-50"
            >
              {t("mobileFallback.backToList")}
            </Link>
          </div>
        </Card>
      </div>

      <main className="hidden md:flex md:flex-col h-[calc(100vh)] overflow-hidden">
        <EditorHeader
          projectKey={projectKey}
          projectName={projectName}
          narrative={tree}
          onPublishedChanged={handleNarrativePatched}
          beforePublish={async () => {
            if (formRef.current) {
              const result = await formRef.current.flush();
              if (!result.ok) {
                window.alert(t("header.publishFlushFailed"));
                return false;
              }
            }
            return true;
          }}
          saveState={saveState}
          savedAt={savedAt}
          saveError={saveError}
          onRetry={() => formRef.current?.retry()}
        />
        <div className="flex flex-1 overflow-hidden">
          <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-surface">
            <StructureSidebar
              tree={tree}
              selected={selected}
              onSelect={tryChangeSelection}
              onForceSelect={setSelected}
              onNarrativePatched={handleNarrativePatched}
              onPhaseListChanged={handlePhaseListChanged}
              onOrphansChanged={handleOrphansChanged}
              onDependencyListChanged={handleDependencyListChanged}
              onRiskListChanged={handleRiskListChanged}
            />
          </aside>
          <section className="flex-1 overflow-y-auto p-6">
            <ActiveFormPanel
              ref={formRef}
              key={selectedKey(selected)}
              tree={tree}
              selected={selected}
              onNarrativePatched={handleNarrativePatched}
              onPhasePatched={handlePhasePatched}
              onWorkstreamPatched={handleWorkstreamPatched}
              onPhaseListChanged={handlePhaseListChanged}
              onOrphansChanged={handleOrphansChanged}
              onDependencyListChanged={handleDependencyListChanged}
              onDependencyPatched={handleDependencyPatched}
              onRiskListChanged={handleRiskListChanged}
              onRiskPatched={handleRiskPatched}
              onSelect={tryChangeSelection}
              onForceSelect={setSelected}
              onSaveStateChange={handleSaveStateChange}
              onAddPhase={addPhase}
              onAddOrphanWorkstream={addOrphanWorkstream}
              bootstrapping={bootstrapping}
            />
          </section>
        </div>
      </main>
    </>
  );
}

function EditorHeader({
  projectKey,
  projectName,
  narrative,
  onPublishedChanged,
  beforePublish,
  saveState,
  savedAt,
  saveError,
  onRetry,
}: {
  projectKey: string;
  projectName: string;
  narrative: NarrativeWithChildren;
  onPublishedChanged: (next: ProjectNarrative) => void;
  beforePublish: () => Promise<boolean>;
  saveState: SaveState;
  savedAt: number | null;
  saveError: string | null;
  onRetry: () => void;
}) {
  const t = useTranslations("narratives.editor.header");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const previewHref = `/projects/${projectKey}/narratives/${narrative.id}/preview`;

  function handlePublishToggle(): void {
    const goingToDraft = narrative.published;
    if (goingToDraft) {
      const ok = window.confirm(t("unpublishConfirm"));
      if (!ok) return;
    }
    startTransition(async () => {
      const flushed = await beforePublish();
      if (!flushed) return;
      try {
        const next = await publishNarrativeAction(
          projectKey,
          narrative.id,
          !narrative.published,
        );
        onPublishedChanged(next);
        if (!goingToDraft) {
          router.push(`/projects/${projectKey}/narratives`);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : t("publishErrorFallback");
        window.alert(msg);
      }
    });
  }

  const publishLabel = pending
    ? t("publish.pending")
    : narrative.published
      ? t("publish.unpublish")
      : t("publish.publish");

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        <nav
          aria-label={t("breadcrumb.aria")}
          className="flex min-w-0 flex-wrap items-center gap-2 text-sm"
        >
          <Link
            href="/projects"
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            {t("breadcrumb.projects")}
          </Link>
          <span aria-hidden="true" className="text-text-muted">
            /
          </span>
          <Link
            href={`/projects/${projectKey}`}
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            {projectName}
          </Link>
          <span aria-hidden="true" className="text-text-muted">
            /
          </span>
          <Link
            href={`/projects/${projectKey}?view=narratives`}
            className="text-text-secondary transition-colors hover:text-text-primary"
          >
            {t("breadcrumb.narratives")}
          </Link>
          <span aria-hidden="true" className="text-text-muted">
            /
          </span>
          <span className="truncate font-medium text-text-primary">
            {narrative.title}
          </span>
        </nav>
        <AutosaveIndicator
          state={saveState}
          lastSavedAt={savedAt}
          errorMessage={saveError}
          onRetry={onRetry}
        />
      </div>
      <div className="flex items-center gap-2">
        <a
          href={previewHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-warm-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          {t("preview")}
        </a>
        <Button
          size="sm"
          variant="primary"
          disabled={pending}
          onClick={handlePublishToggle}
        >
          {publishLabel}
        </Button>
      </div>
    </header>
  );
}

function selectedKey(s: SelectedNode): string {
  if (s.kind === "narrative") return "narrative";
  if (s.kind === "dependencies") return "dependencies";
  if (s.kind === "risks") return "risks";
  return `${s.kind}:${s.id}`;
}
