"use client";

import { useTransition } from "react";
import {
  deletePhaseAction,
  deleteWorkstreamAction,
} from "@/app/actions/narratives";
import type {
  NarrativePhase,
  NarrativePhaseWithWorkstreams,
  NarrativeWithChildren,
  NarrativeWorkstream,
  ProjectNarrative,
} from "@/lib/narratives/types";
import type { SelectedNode } from "./EditorShell";
import { NarrativeForm } from "./NarrativeForm";
import { PhaseForm } from "./PhaseForm";
import { WorkstreamForm } from "./WorkstreamForm";

export function ActiveFormPanel({
  tree,
  selected,
  onNarrativePatched,
  onPhasePatched,
  onWorkstreamPatched,
  onPhaseListChanged,
  onOrphansChanged,
  onSelect,
}: {
  tree: NarrativeWithChildren;
  selected: SelectedNode;
  onNarrativePatched: (next: ProjectNarrative) => void;
  onPhasePatched: (next: NarrativePhase) => void;
  onWorkstreamPatched: (next: NarrativeWorkstream) => void;
  onPhaseListChanged: (next: NarrativePhaseWithWorkstreams[]) => void;
  onOrphansChanged: (next: NarrativeWorkstream[]) => void;
  onSelect: (next: SelectedNode) => void;
}) {
  const [pending, startTransition] = useTransition();

  if (selected.kind === "narrative") {
    return (
      <NarrativeForm
        narrative={tree}
        onPatched={onNarrativePatched}
      />
    );
  }

  if (selected.kind === "phase") {
    const phase = tree.phases.find((p) => p.id === selected.id);
    if (!phase) {
      return <FormNotFound message="Fase no encontrada." />;
    }
    return (
      <PhaseForm
        phase={phase}
        onPatched={onPhasePatched}
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
  }

  // workstream
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
      workstream={workstream}
      phases={tree.phases}
      onPatched={(next) => {
        onWorkstreamPatched(next);
        // If phase_id changed, rebalance the tree.
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
      pendingDelete={pending}
      onDelete={() => {
        if (
          !window.confirm(
            `¿Eliminar el workstream "${workstream.name}"?`,
          )
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
}

function FormNotFound({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-default-300 p-8 text-center text-sm text-muted">
      {message}
    </div>
  );
}

// Move a workstream to its new phase_id within the tree state. Used when
// the form's phase select fires updateWorkstream — we get back the
// updated workstream and have to relocate it in the tree.
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
        ? {
            ...p,
            workstreams: p.workstreams.filter((w) => w.id !== prev.id),
          }
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
