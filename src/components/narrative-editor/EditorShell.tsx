"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { ExternalLink } from "lucide-react";
import { publishNarrativeAction } from "@/app/actions/narratives";
import { UserMenu } from "@/components/UserMenu";
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
  userEmail,
  userDisplayName,
}: {
  projectKey: string;
  projectName: string;
  initialNarrative: NarrativeWithChildren;
  userEmail: string;
  userDisplayName: string;
}) {
  const [tree, setTree] = useState<NarrativeWithChildren>(initialNarrative);
  const [selected, setSelected] = useState<SelectedNode>(NARRATIVE_NODE);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  // Selection guard: flush the active form before changing selection. If
  // the flush fails (validation error or server error), keep the current
  // selection so the user can fix the field. The indicator stays in
  // 'error' state — they retry via Reintentar.
  const tryChangeSelection = useCallback(
    async (next: SelectedNode): Promise<void> => {
      if (formRef.current) {
        const result = await formRef.current.flush();
        if (!result.ok) {
          setSaveError(
            "No se pudo guardar el formulario. Revisá los campos antes de cambiar de sección.",
          );
          return;
        }
      }
      setSelected(next);
    },
    [],
  );

  return (
    <>
      <div className="md:hidden p-8 text-center">
        <h1 className="text-lg font-semibold">
          Editor disponible en pantallas más anchas
        </h1>
        <p className="mt-2 text-sm text-muted">
          Volvé a abrir esta página desde una notebook o pantalla de
          escritorio. El editor de narrativas necesita más espacio del
          que tiene tu dispositivo actual.
        </p>
        <Link
          href={`/projects/${projectKey}/narratives`}
          className="mt-4 inline-block text-sm underline"
        >
          Volver al listado
        </Link>
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
                window.alert(
                  "No se pudo guardar el formulario. Revisá los campos antes de publicar.",
                );
                return false;
              }
            }
            return true;
          }}
          saveState={saveState}
          savedAt={savedAt}
          saveError={saveError}
          onRetry={() => formRef.current?.retry()}
          userEmail={userEmail}
          userDisplayName={userDisplayName}
        />
        <div className="flex flex-1 overflow-hidden border-t border-default-200">
          <aside className="flex w-80 shrink-0 flex-col border-r border-default-200 bg-surface">
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
  userEmail,
  userDisplayName,
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
  userEmail: string;
  userDisplayName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const previewHref = `/projects/${projectKey}/narratives/${narrative.id}/preview`;

  function handlePublishToggle(): void {
    const goingToDraft = narrative.published;
    if (goingToDraft) {
      const ok = window.confirm(
        "¿Despublicar esta narrativa? Dejará de ser visible en la vista pública.",
      );
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
        const msg = err instanceof Error ? err.message : "Error al publicar";
        window.alert(msg);
      }
    });
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link href="/projects" className="hover:underline">
            Proyectos
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={`/projects/${projectKey}`} className="hover:underline">
            {projectName}
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={`/projects/${projectKey}/narratives`}
            className="hover:underline"
          >
            Narrativas
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-foreground">{narrative.title}</span>
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
          className="inline-flex items-center gap-1.5 rounded-md border border-default-300 bg-surface px-3 py-1.5 text-sm hover:bg-default-50"
        >
          <ExternalLink className="size-4" />
          Vista previa
        </a>
        <Button
          variant={narrative.published ? "secondary" : undefined}
          isDisabled={pending}
          onPress={handlePublishToggle}
        >
          {pending
            ? "Aplicando…"
            : narrative.published
              ? "Despublicar"
              : "Publicar"}
        </Button>
        <UserMenu email={userEmail} displayName={userDisplayName} />
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
