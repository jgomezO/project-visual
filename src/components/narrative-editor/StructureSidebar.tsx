"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Button,
  Dropdown,
  Label,
} from "@heroui/react";
import {
  ChevronDown,
  ChevronRight,
  CircleDot,
  FileText,
  Layers,
  Link2,
  MoreHorizontal,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  createDependencyAction,
  createPhaseAction,
  createWorkstreamAction,
  deleteDependencyAction,
  deletePhaseAction,
  deleteWorkstreamAction,
  reorderDependenciesAction,
  reorderPhasesAction,
  updateWorkstreamAction,
} from "@/app/actions/narratives";
import type {
  NarrativeDependency,
  NarrativePhaseWithWorkstreams,
  NarrativeWithChildren,
  NarrativeWorkstream,
} from "@/lib/narratives/types";
import type { SelectedNode } from "./EditorShell";

export function StructureSidebar({
  tree,
  selected,
  onSelect,
  onForceSelect,
  onPhaseListChanged,
  onOrphansChanged,
  onDependencyListChanged,
}: {
  tree: NarrativeWithChildren;
  selected: SelectedNode;
  onSelect: (next: SelectedNode) => void;
  onForceSelect: (next: SelectedNode) => void;
  onNarrativePatched: (next: NarrativeWithChildren) => void;
  onPhaseListChanged: (next: NarrativePhaseWithWorkstreams[]) => void;
  onOrphansChanged: (next: NarrativeWorkstream[]) => void;
  onDependencyListChanged: (next: NarrativeDependency[]) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tree.phases.map((p) => p.id)),
  );

  function toggleExpanded(phaseId: string): void {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  function handleAddPhase(): void {
    setError(null);
    startTransition(async () => {
      try {
        const created = await createPhaseAction({
          narrative_id: tree.id,
          order_index: tree.phases.length,
          name: "Nueva fase",
          status: "upcoming",
        });
        onPhaseListChanged([
          ...tree.phases,
          { ...created, workstreams: [] },
        ]);
        setExpanded((prev) => new Set(prev).add(created.id));
        onSelect({ kind: "phase", id: created.id });
      } catch (err) {
        setError(messageOf(err, "No se pudo crear la fase"));
      }
    });
  }

  function handleAddWorkstream(phaseId: string | null): void {
    setError(null);
    startTransition(async () => {
      try {
        const orderIndex =
          phaseId === null
            ? tree.orphan_workstreams.length
            : (tree.phases.find((p) => p.id === phaseId)?.workstreams.length ??
              0);
        const created = await createWorkstreamAction({
          narrative_id: tree.id,
          phase_id: phaseId,
          order_index: orderIndex,
          name: "Nuevo workstream",
          jira_issue_keys: [],
        });
        if (phaseId === null) {
          onOrphansChanged([...tree.orphan_workstreams, created]);
        } else {
          onPhaseListChanged(
            tree.phases.map((p) =>
              p.id === phaseId
                ? { ...p, workstreams: [...p.workstreams, created] }
                : p,
            ),
          );
          setExpanded((prev) => new Set(prev).add(phaseId));
        }
        onSelect({ kind: "workstream", id: created.id });
      } catch (err) {
        setError(messageOf(err, "No se pudo crear el workstream"));
      }
    });
  }

  function handleDeletePhase(phase: NarrativePhaseWithWorkstreams): void {
    if (
      !window.confirm(
        `¿Eliminar la fase "${phase.name}"? Sus workstreams también se eliminarán.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deletePhaseAction(phase.id);
        onPhaseListChanged(tree.phases.filter((p) => p.id !== phase.id));
        if (selected.kind === "phase" && selected.id === phase.id) {
          onForceSelect({ kind: "narrative" });
        } else if (
          selected.kind === "workstream" &&
          phase.workstreams.some((w) => w.id === selected.id)
        ) {
          onForceSelect({ kind: "narrative" });
        }
      } catch (err) {
        setError(messageOf(err, "No se pudo eliminar la fase"));
      }
    });
  }

  function handleDeleteWorkstream(workstream: NarrativeWorkstream): void {
    if (
      !window.confirm(
        `¿Eliminar el workstream "${workstream.name}"?`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await deleteWorkstreamAction(workstream.id);
        if (workstream.phase_id === null) {
          onOrphansChanged(
            tree.orphan_workstreams.filter((w) => w.id !== workstream.id),
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
        if (selected.kind === "workstream" && selected.id === workstream.id) {
          onForceSelect({ kind: "narrative" });
        }
      } catch (err) {
        setError(messageOf(err, "No se pudo eliminar el workstream"));
      }
    });
  }

  function handleMovePhase(phaseId: string, direction: "up" | "down"): void {
    const idx = tree.phases.findIndex((p) => p.id === phaseId);
    if (idx === -1) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= tree.phases.length) return;

    const reorder = [...tree.phases];
    [reorder[idx], reorder[swapWith]] = [reorder[swapWith], reorder[idx]];
    const withNewIndices = reorder.map((p, i) => ({
      ...p,
      order_index: i,
    }));
    // Optimistic update
    const previous = tree.phases;
    onPhaseListChanged(withNewIndices);

    setError(null);
    startTransition(async () => {
      try {
        await reorderPhasesAction(
          tree.id,
          withNewIndices.map((p) => ({ id: p.id, order_index: p.order_index })),
        );
      } catch (err) {
        onPhaseListChanged(previous);
        setError(messageOf(err, "No se pudo mover la fase"));
      }
    });
  }

  function handleAddDependency(): void {
    setError(null);
    startTransition(async () => {
      try {
        const created = await createDependencyAction({
          narrative_id: tree.id,
          order_index: tree.dependencies.length,
          title: "Nueva dependencia",
          commitment_status: "proposed",
          provider_jira_issue_keys: [],
        });
        onDependencyListChanged([...tree.dependencies, created]);
        // Land directly on the new dependency's form so the PM can
        // start filling it in.
        onSelect({ kind: "dependency", id: created.id });
      } catch (err) {
        setError(messageOf(err, "No se pudo crear la dependencia"));
      }
    });
  }

  function handleDeleteDependency(dep: NarrativeDependency): void {
    if (!window.confirm(`¿Eliminar la dependencia "${dep.title}"?`)) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteDependencyAction(dep.id);
        onDependencyListChanged(
          tree.dependencies.filter((d) => d.id !== dep.id),
        );
        if (selected.kind === "dependency" && selected.id === dep.id) {
          onForceSelect({ kind: "dependencies" });
        }
      } catch (err) {
        setError(messageOf(err, "No se pudo eliminar la dependencia"));
      }
    });
  }

  function handleMoveDependency(
    dependencyId: string,
    direction: "up" | "down",
  ): void {
    const idx = tree.dependencies.findIndex((d) => d.id === dependencyId);
    if (idx === -1) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= tree.dependencies.length) return;

    const reorder = [...tree.dependencies];
    [reorder[idx], reorder[swapWith]] = [reorder[swapWith], reorder[idx]];
    const withNewIndices = reorder.map((d, i) => ({
      ...d,
      order_index: i,
    }));
    const previous = tree.dependencies;
    onDependencyListChanged(withNewIndices);

    setError(null);
    startTransition(async () => {
      try {
        await reorderDependenciesAction(
          tree.id,
          withNewIndices.map((d) => ({
            id: d.id,
            order_index: d.order_index,
          })),
        );
      } catch (err) {
        onDependencyListChanged(previous);
        setError(messageOf(err, "No se pudo mover la dependencia"));
      }
    });
  }

  function handleMoveWorkstreamToPhase(
    workstream: NarrativeWorkstream,
    targetPhaseId: string | null,
  ): void {
    if (workstream.phase_id === targetPhaseId) return;
    const targetIndex =
      targetPhaseId === null
        ? tree.orphan_workstreams.length
        : (tree.phases.find((p) => p.id === targetPhaseId)?.workstreams
            .length ?? 0);

    setError(null);
    startTransition(async () => {
      try {
        const updated = await updateWorkstreamAction(workstream.id, {
          phase_id: targetPhaseId,
          order_index: targetIndex,
        });
        // Remove from old location
        let nextPhases = tree.phases;
        let nextOrphans = tree.orphan_workstreams;
        if (workstream.phase_id === null) {
          nextOrphans = nextOrphans.filter((w) => w.id !== workstream.id);
        } else {
          nextPhases = nextPhases.map((p) =>
            p.id === workstream.phase_id
              ? {
                  ...p,
                  workstreams: p.workstreams.filter(
                    (w) => w.id !== workstream.id,
                  ),
                }
              : p,
          );
        }
        // Add at the new location
        if (targetPhaseId === null) {
          nextOrphans = [...nextOrphans, updated];
        } else {
          nextPhases = nextPhases.map((p) =>
            p.id === targetPhaseId
              ? { ...p, workstreams: [...p.workstreams, updated] }
              : p,
          );
          setExpanded((prev) => new Set(prev).add(targetPhaseId));
        }
        onPhaseListChanged(nextPhases);
        onOrphansChanged(nextOrphans);
      } catch (err) {
        setError(messageOf(err, "No se pudo mover el workstream"));
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 overflow-y-auto p-3">
        <li>
          <NarrativeRow
            tree={tree}
            isSelected={selected.kind === "narrative"}
            onSelect={() => onSelect({ kind: "narrative" })}
          />
        </li>
        {tree.phases.length === 0 && tree.orphan_workstreams.length === 0 ? (
          <li className="mt-3 px-2 text-xs italic text-muted">
            Esta narrativa no tiene fases ni workstreams todavía. Empezá
            agregando una fase o un workstream sin fase.
          </li>
        ) : null}
        {tree.phases.map((phase, idx) => (
          <li key={phase.id} className="mt-1">
            <PhaseRow
              phase={phase}
              isSelected={
                selected.kind === "phase" && selected.id === phase.id
              }
              isExpanded={expanded.has(phase.id)}
              onToggleExpanded={() => toggleExpanded(phase.id)}
              onSelect={() => onSelect({ kind: "phase", id: phase.id })}
              onMoveUp={
                idx > 0 ? () => handleMovePhase(phase.id, "up") : null
              }
              onMoveDown={
                idx < tree.phases.length - 1
                  ? () => handleMovePhase(phase.id, "down")
                  : null
              }
              onDelete={() => handleDeletePhase(phase)}
              pending={pending}
            />
            {expanded.has(phase.id) ? (
              <ul className="ml-3 mt-0.5 border-l border-default-200 pl-2">
                {phase.workstreams.length === 0 ? (
                  <li className="px-2 py-1 text-xs italic text-muted">
                    Sin workstreams
                  </li>
                ) : (
                  phase.workstreams.map((w) => (
                    <li key={w.id}>
                      <WorkstreamRow
                        workstream={w}
                        isSelected={
                          selected.kind === "workstream" &&
                          selected.id === w.id
                        }
                        phases={tree.phases}
                        onSelect={() =>
                          onSelect({ kind: "workstream", id: w.id })
                        }
                        onMoveToPhase={(target) =>
                          handleMoveWorkstreamToPhase(w, target)
                        }
                        onDelete={() => handleDeleteWorkstream(w)}
                        pending={pending}
                      />
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </li>
        ))}
        {tree.orphan_workstreams.length > 0 ? (
          <li className="mt-3">
            <p className="px-2 text-[10px] uppercase tracking-wide text-muted">
              Sin fase
            </p>
            <ul>
              {tree.orphan_workstreams.map((w) => (
                <li key={w.id}>
                  <WorkstreamRow
                    workstream={w}
                    isSelected={
                      selected.kind === "workstream" && selected.id === w.id
                    }
                    phases={tree.phases}
                    onSelect={() =>
                      onSelect({ kind: "workstream", id: w.id })
                    }
                    onMoveToPhase={(target) =>
                      handleMoveWorkstreamToPhase(w, target)
                    }
                    onDelete={() => handleDeleteWorkstream(w)}
                    pending={pending}
                    isOrphan
                  />
                </li>
              ))}
            </ul>
          </li>
        ) : null}

        {/* Dependencies group is always visible — even with 0 deps the
            PM needs to be able to add. Individual children render
            beneath when present. */}
        <li className="mt-3 border-t border-default-200 pt-3">
          <DependenciesGroupRow
            count={tree.dependencies.length}
            isSelected={selected.kind === "dependencies"}
            onSelect={() => onSelect({ kind: "dependencies" })}
          />
          {tree.dependencies.length > 0 ? (
            <ul className="ml-3 mt-0.5 border-l border-default-200 pl-2">
              {tree.dependencies.map((dep, idx) => (
                <li key={dep.id}>
                  <DependencyRow
                    dependency={dep}
                    isSelected={
                      selected.kind === "dependency" &&
                      selected.id === dep.id
                    }
                    onSelect={() =>
                      onSelect({ kind: "dependency", id: dep.id })
                    }
                    onMoveUp={
                      idx > 0
                        ? () => handleMoveDependency(dep.id, "up")
                        : null
                    }
                    onMoveDown={
                      idx < tree.dependencies.length - 1
                        ? () => handleMoveDependency(dep.id, "down")
                        : null
                    }
                    onDelete={() => handleDeleteDependency(dep)}
                    pending={pending}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      </ul>

      <div className="flex flex-col gap-2 border-t border-default-200 p-3">
        {error ? (
          <p className="text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          size="sm"
          variant="secondary"
          isDisabled={pending}
          onPress={handleAddPhase}
        >
          <Plus className="size-4" />
          Agregar fase
        </Button>
        <AddWorkstreamButton
          phases={tree.phases}
          onPick={handleAddWorkstream}
          pending={pending}
        />
        <Button
          size="sm"
          variant="secondary"
          isDisabled={pending}
          onPress={handleAddDependency}
        >
          <Plus className="size-4" />
          Agregar dependencia
        </Button>
      </div>
    </div>
  );
}

function DependenciesGroupRow({
  count,
  isSelected,
  onSelect,
}: {
  count: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={selectableRowClasses(isSelected)}
    >
      <Link2 className="size-4 shrink-0 text-muted" aria-hidden="true" />
      <span className="truncate text-sm font-medium">Dependencias</span>
      <span className="ml-auto rounded-full bg-default-200 px-2 py-0.5 text-[10px] font-semibold text-muted">
        {count}
      </span>
    </button>
  );
}

function DependencyRow({
  dependency,
  isSelected,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  pending,
}: {
  dependency: NarrativeDependency;
  isSelected: boolean;
  onSelect: () => void;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  onDelete: () => void;
  pending: boolean;
}) {
  return (
    <div className="group relative flex items-center gap-1">
      <button
        type="button"
        onClick={onSelect}
        className={`${selectableRowClasses(isSelected)} flex-1`}
      >
        <Link2
          className="size-3.5 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span className="truncate text-sm">{dependency.title}</span>
      </button>
      <Dropdown>
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label={`Acciones para ${dependency.title}`}
          isDisabled={pending}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={(key) => {
              if (key === "up") onMoveUp?.();
              else if (key === "down") onMoveDown?.();
              else if (key === "delete") onDelete();
            }}
          >
            <Dropdown.Item
              id="up"
              textValue="Mover arriba"
              isDisabled={onMoveUp === null}
            >
              <Label>Mover arriba</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="down"
              textValue="Mover abajo"
              isDisabled={onMoveDown === null}
            >
              <Label>Mover abajo</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="delete"
              textValue="Eliminar"
              variant="danger"
            >
              <Label>Eliminar</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

function NarrativeRow({
  tree,
  isSelected,
  onSelect,
}: {
  tree: NarrativeWithChildren;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={selectableRowClasses(isSelected)}
    >
      <FileText className="size-4 shrink-0 text-muted" aria-hidden="true" />
      <span className="truncate text-sm font-medium">{tree.title}</span>
    </button>
  );
}

function PhaseRow({
  phase,
  isSelected,
  isExpanded,
  onToggleExpanded,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  pending,
}: {
  phase: NarrativePhaseWithWorkstreams;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onSelect: () => void;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
  onDelete: () => void;
  pending: boolean;
}) {
  const Chevron = isExpanded ? ChevronDown : ChevronRight;
  return (
    <div className="group relative flex items-center gap-1">
      <button
        type="button"
        onClick={onToggleExpanded}
        className="rounded p-0.5 hover:bg-default-200"
        aria-label={isExpanded ? "Colapsar fase" : "Expandir fase"}
      >
        <Chevron className="size-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className={`${selectableRowClasses(isSelected)} flex-1`}
      >
        <Layers
          className="size-4 shrink-0 text-muted"
          aria-hidden="true"
        />
        <span className="truncate text-sm">{phase.name}</span>
      </button>
      <Dropdown>
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label={`Acciones para ${phase.name}`}
          isDisabled={pending}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={(key) => {
              if (key === "up") onMoveUp?.();
              else if (key === "down") onMoveDown?.();
              else if (key === "delete") onDelete();
            }}
          >
            <Dropdown.Item
              id="up"
              textValue="Mover arriba"
              isDisabled={onMoveUp === null}
            >
              <Label>Mover arriba</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="down"
              textValue="Mover abajo"
              isDisabled={onMoveDown === null}
            >
              <Label>Mover abajo</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="delete"
              textValue="Eliminar"
              variant="danger"
            >
              <Label>Eliminar</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

function WorkstreamRow({
  workstream,
  isSelected,
  phases,
  onSelect,
  onMoveToPhase,
  onDelete,
  pending,
  isOrphan = false,
}: {
  workstream: NarrativeWorkstream;
  isSelected: boolean;
  phases: NarrativePhaseWithWorkstreams[];
  onSelect: () => void;
  onMoveToPhase: (target: string | null) => void;
  onDelete: () => void;
  pending: boolean;
  isOrphan?: boolean;
}) {
  const moveTargets = useMemo(() => {
    const items: { id: string; label: string; phaseId: string | null }[] = [];
    for (const p of phases) {
      if (workstream.phase_id !== p.id) {
        items.push({ id: `phase:${p.id}`, label: p.name, phaseId: p.id });
      }
    }
    if (workstream.phase_id !== null) {
      items.push({ id: "orphan", label: "Sin fase", phaseId: null });
    }
    return items;
  }, [phases, workstream.phase_id]);

  return (
    <div className="group relative flex items-center gap-1">
      <button
        type="button"
        onClick={onSelect}
        className={`${selectableRowClasses(isSelected)} flex-1`}
      >
        {isOrphan ? (
          <Sparkles
            className="size-3.5 shrink-0 text-amber-500"
            aria-hidden="true"
          />
        ) : (
          <CircleDot
            className="size-3.5 shrink-0 text-muted"
            aria-hidden="true"
          />
        )}
        <span className="truncate text-sm">{workstream.name}</span>
      </button>
      <Dropdown>
        <Button
          isIconOnly
          size="sm"
          variant="tertiary"
          aria-label={`Acciones para ${workstream.name}`}
          isDisabled={pending}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <MoreHorizontal className="size-3.5" />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={(key) => {
              if (key === "delete") {
                onDelete();
                return;
              }
              const k = String(key);
              if (k === "orphan") {
                onMoveToPhase(null);
              } else if (k.startsWith("phase:")) {
                onMoveToPhase(k.slice("phase:".length));
              }
            }}
          >
            <>
              {moveTargets.map((t) => (
                <Dropdown.Item
                  key={t.id}
                  id={t.id}
                  textValue={`Mover a ${t.label}`}
                >
                  <Label>Mover a {t.label}</Label>
                </Dropdown.Item>
              ))}
              <Dropdown.Item
                id="delete"
                textValue="Eliminar"
                variant="danger"
              >
                <Label>Eliminar</Label>
              </Dropdown.Item>
            </>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}

function AddWorkstreamButton({
  phases,
  onPick,
  pending,
}: {
  phases: NarrativePhaseWithWorkstreams[];
  onPick: (phaseId: string | null) => void;
  pending: boolean;
}) {
  // Single-button shortcut when there are no phases yet — no menu needed.
  if (phases.length === 0) {
    return (
      <Button
        size="sm"
        variant="secondary"
        isDisabled={pending}
        onPress={() => onPick(null)}
      >
        <Plus className="size-4" />
        Agregar workstream
      </Button>
    );
  }
  return (
    <Dropdown>
      <Button size="sm" variant="secondary" isDisabled={pending}>
        <Plus className="size-4" />
        Agregar workstream
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu
          onAction={(key) => {
            const k = String(key);
            if (k === "orphan") onPick(null);
            else if (k.startsWith("phase:"))
              onPick(k.slice("phase:".length));
          }}
        >
          <>
            {phases.map((p) => (
              <Dropdown.Item
                key={`phase:${p.id}`}
                id={`phase:${p.id}`}
                textValue={`Al final de ${p.name}`}
              >
                <Label>Al final de {p.name}</Label>
              </Dropdown.Item>
            ))}
            <Dropdown.Item id="orphan" textValue="Sin fase">
              <Label>Sin fase</Label>
            </Dropdown.Item>
          </>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function selectableRowClasses(isSelected: boolean): string {
  const base =
    "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400";
  return isSelected
    ? `${base} bg-default-200 text-foreground`
    : `${base} hover:bg-default-100`;
}

function messageOf(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
