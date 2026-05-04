"use client";

import { forwardRef, useImperativeHandle, useRef, useTransition } from "react";
import {
  deleteDependencyAction,
  deletePhaseAction,
  deleteWorkstreamAction,
} from "@/app/actions/narratives";
import type {
  NarrativeDependency,
  NarrativePhase,
  NarrativePhaseWithWorkstreams,
  NarrativeWithChildren,
  NarrativeWorkstream,
  ProjectNarrative,
} from "@/lib/narratives/types";
import { DependenciesListPanel } from "./DependenciesListPanel";
import type { SelectedNode } from "./EditorShell";
import { NarrativeForm, type FormHandle } from "./NarrativeForm";
import { PhaseForm } from "./PhaseForm";
import { WorkstreamForm } from "./WorkstreamForm";
import type { SaveState } from "./useAutoSave";

interface Props {
  tree: NarrativeWithChildren;
  selected: SelectedNode;
  onNarrativePatched: (next: ProjectNarrative) => void;
  onPhasePatched: (next: NarrativePhase) => void;
  onWorkstreamPatched: (next: NarrativeWorkstream) => void;
  onPhaseListChanged: (next: NarrativePhaseWithWorkstreams[]) => void;
  onOrphansChanged: (next: NarrativeWorkstream[]) => void;
  onDependencyListChanged: (next: NarrativeDependency[]) => void;
  onDependencyPatched: (next: NarrativeDependency) => void;
  // For moves that may save a pending edit first.
  onSelect: (next: SelectedNode) => void;
  // Bypasses the auto-save flush guard. Used after delete: the entity
  // no longer exists, so any pending save would fail with "row not found".
  onForceSelect: (next: SelectedNode) => void;
  onSaveStateChange?: (state: SaveState) => void;
}

export const ActiveFormPanel = forwardRef<FormHandle, Props>(
  function ActiveFormPanel(
    {
      tree,
      selected,
      onNarrativePatched,
      onPhasePatched,
      onWorkstreamPatched,
      onPhaseListChanged,
      onOrphansChanged,
      onDependencyListChanged,
      onSelect,
      onForceSelect,
      onSaveStateChange,
    },
    ref,
  ) {
    const innerRef = useRef<FormHandle | null>(null);
    const [pending, startTransition] = useTransition();

    useImperativeHandle(
      ref,
      () => ({
        flush: async () =>
          innerRef.current?.flush() ?? Promise.resolve({ ok: true }),
        retry: () => innerRef.current?.retry(),
      }),
      [],
    );

    if (selected.kind === "narrative") {
      const isEmptyStructure =
        tree.phases.length === 0 && tree.orphan_workstreams.length === 0;
      return (
        <div className="flex flex-col gap-5">
          {isEmptyStructure ? (
            <div className="rounded-xl border border-dashed border-default-300 bg-default-50 px-4 py-3 text-sm text-muted">
              Esta narrativa todavía no tiene estructura. Agregá una fase
              o un workstream desde el panel izquierdo para empezar.
            </div>
          ) : null}
          <NarrativeForm
            ref={innerRef}
            narrative={tree}
            onPatched={onNarrativePatched}
            onSaveStateChange={onSaveStateChange}
          />
        </div>
      );
    }

    if (selected.kind === "phase") {
      const phase = tree.phases.find((p) => p.id === selected.id);
      if (!phase) {
        return <FormNotFound message="Fase no encontrada." />;
      }
      return (
        <PhaseForm
          ref={innerRef}
          phase={phase}
          onPatched={onPhasePatched}
          onSaveStateChange={onSaveStateChange}
          pendingDelete={pending}
          onDelete={() => {
            if (
              !window.confirm(
                `¿Eliminar la fase "${phase.name}"? Sus workstreams también se eliminarán.`,
              )
            ) {
              return;
            }
            startTransition(async () => {
              try {
                await deletePhaseAction(phase.id);
                onPhaseListChanged(
                  tree.phases.filter((p) => p.id !== phase.id),
                );
                onForceSelect({ kind: "narrative" });
              } catch (err) {
                window.alert(
                  err instanceof Error ? err.message : "Error al eliminar",
                );
              }
            });
          }}
        />
      );
    }

    if (selected.kind === "dependencies") {
      return (
        <DependenciesListPanel
          tree={tree}
          pending={pending}
          onDeleteDependency={(dep) => {
            if (
              !window.confirm(
                `¿Eliminar la dependencia "${dep.title}"?`,
              )
            ) {
              return;
            }
            startTransition(async () => {
              try {
                await deleteDependencyAction(dep.id);
                onDependencyListChanged(
                  tree.dependencies.filter((d) => d.id !== dep.id),
                );
              } catch (err) {
                window.alert(
                  err instanceof Error ? err.message : "Error al eliminar",
                );
              }
            });
          }}
        />
      );
    }

    if (selected.kind === "dependency") {
      const dep = tree.dependencies.find((d) => d.id === selected.id);
      if (!dep) {
        return <FormNotFound message="Dependencia no encontrada." />;
      }
      // Placeholder pending the full DependencyForm in commit 4. The
      // sidebar already lets the user add / delete / reorder; this branch
      // is only reachable if commit 4's selectable dep rows are wired up
      // independently — kept here so the SelectedNode union stays
      // exhaustive.
      return (
        <FormNotFound message="Editor de dependencia: llega en el próximo commit." />
      );
    }

    const flat: NarrativeWorkstream[] = [
      ...tree.phases.flatMap((p) => p.workstreams),
      ...tree.orphan_workstreams,
    ];
    const workstream = flat.find((w) => w.id === selected.id);
    if (!workstream) {
      return <FormNotFound message="Workstream no encontrado." />;
    }
    return (
      <WorkstreamForm
        ref={innerRef}
        workstream={workstream}
        phases={tree.phases}
        projectId={tree.project_id}
        onPatched={(next) => {
          onWorkstreamPatched(next);
          if (next.phase_id !== workstream.phase_id) {
            rebalanceWorkstream(
              workstream,
              next,
              tree,
              onPhaseListChanged,
              onOrphansChanged,
            );
          }
        }}
        onSaveStateChange={onSaveStateChange}
        pendingDelete={pending}
        onDelete={() => {
          if (
            !window.confirm(`¿Eliminar el workstream "${workstream.name}"?`)
          ) {
            return;
          }
          startTransition(async () => {
            try {
              await deleteWorkstreamAction(workstream.id);
              if (workstream.phase_id === null) {
                onOrphansChanged(
                  tree.orphan_workstreams.filter(
                    (w) => w.id !== workstream.id,
                  ),
                );
              } else {
                onPhaseListChanged(
                  tree.phases.map((p) =>
                    p.id === workstream.phase_id
                      ? {
                          ...p,
                          workstreams: p.workstreams.filter(
                            (w) => w.id !== workstream.id,
                          ),
                        }
                      : p,
                  ),
                );
              }
              onSelect({ kind: "narrative" });
            } catch (err) {
              window.alert(
                err instanceof Error ? err.message : "Error al eliminar",
              );
            }
          });
        }}
      />
    );
  },
);

function FormNotFound({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-default-300 p-8 text-center text-sm text-muted">
      {message}
    </div>
  );
}

function rebalanceWorkstream(
  prev: NarrativeWorkstream,
  next: NarrativeWorkstream,
  tree: NarrativeWithChildren,
  onPhaseListChanged: (next: NarrativePhaseWithWorkstreams[]) => void,
  onOrphansChanged: (next: NarrativeWorkstream[]) => void,
): void {
  let phases = tree.phases;
  let orphans = tree.orphan_workstreams;

  if (prev.phase_id === null) {
    orphans = orphans.filter((w) => w.id !== prev.id);
  } else {
    phases = phases.map((p) =>
      p.id === prev.phase_id
        ? { ...p, workstreams: p.workstreams.filter((w) => w.id !== prev.id) }
        : p,
    );
  }

  if (next.phase_id === null) {
    orphans = [...orphans, next];
  } else {
    phases = phases.map((p) =>
      p.id === next.phase_id
        ? { ...p, workstreams: [...p.workstreams, next] }
        : p,
    );
  }

  onPhaseListChanged(phases);
  onOrphansChanged(orphans);
}
