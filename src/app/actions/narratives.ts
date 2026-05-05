"use server";

import { revalidatePath } from "next/cache";
import { getActor } from "@/lib/auth/get-actor";
import {
  createDependency,
  createNarrative,
  createPhase,
  createRisk,
  createWorkstream,
  deleteDependency,
  deleteNarrative,
  deletePhase,
  deleteRisk,
  deleteWorkstream,
  duplicateNarrative,
  reorderDependencies,
  reorderPhases,
  reorderRisks,
  reorderWorkstreams,
  updateDependency,
  updateNarrative,
  updatePhase,
  updateRisk,
  updateWorkstream,
  type CreateDependencyInput,
  type CreateNarrativeInput,
  type CreatePhaseInput,
  type CreateRiskInput,
  type CreateWorkstreamInput,
  type DependencyReorderEntry,
  type PhaseReorderEntry,
  type RiskReorderEntry,
  type UpdateDependencyInput,
  type UpdateNarrativeInput,
  type UpdatePhaseInput,
  type UpdateRiskInput,
  type UpdateWorkstreamInput,
  type WorkstreamReorderEntry,
} from "@/lib/narratives/mutations";
import type {
  NarrativeDependency,
  NarrativePhase,
  NarrativeRisk,
  NarrativeWorkstream,
  ProjectNarrative,
} from "@/lib/narratives/types";

// All mutations route through Server Actions so secrets stay on the server
// and Client Components can `await` them directly without an HTTP layer.
//
// Actions that touch the columns created_by / updated_by (project_narratives,
// narrative_dependencies, narrative_risks) call getActor() and stamp the
// authenticated user's email. Phases and workstreams don't have those
// columns — their actions don't need an actor.
//
// `revalidatePath` is fired only on actions whose result changes the list
// page (`/projects/[key]/narratives`). Editor-side actions skip the
// revalidation because the editor is already a Client tree-state owner —
// the form receives the returned entity and patches in place.

export async function createNarrativeAction(
  projectKey: string,
  input: CreateNarrativeInput,
): Promise<ProjectNarrative> {
  const actor = await getActor();
  const created = await createNarrative({
    ...input,
    created_by: actor.email,
    updated_by: actor.email,
  });
  revalidatePath(`/projects/${projectKey}/narratives`);
  return created;
}

export async function updateNarrativeAction(
  id: string,
  patch: UpdateNarrativeInput,
): Promise<ProjectNarrative> {
  const actor = await getActor();
  return updateNarrative(id, { ...patch, updated_by: actor.email });
}

export async function deleteNarrativeAction(
  projectKey: string,
  id: string,
): Promise<void> {
  await deleteNarrative(id);
  revalidatePath(`/projects/${projectKey}/narratives`);
}

export async function duplicateNarrativeAction(
  projectKey: string,
  sourceId: string,
): Promise<ProjectNarrative> {
  const actor = await getActor();
  const copy = await duplicateNarrative(sourceId, actor.email);
  revalidatePath(`/projects/${projectKey}/narratives`);
  return copy;
}

export async function publishNarrativeAction(
  projectKey: string,
  id: string,
  published: boolean,
): Promise<ProjectNarrative> {
  // Inlined what used to be publishNarrative — toggling published is a
  // narrative update, so we want updated_by to reflect the actor that
  // pressed the button.
  const actor = await getActor();
  const updated = await updateNarrative(id, {
    published,
    updated_by: actor.email,
  });
  revalidatePath(`/projects/${projectKey}/narratives`);
  return updated;
}

export async function createPhaseAction(
  input: CreatePhaseInput,
): Promise<NarrativePhase> {
  return createPhase(input);
}

export async function updatePhaseAction(
  id: string,
  patch: UpdatePhaseInput,
): Promise<NarrativePhase> {
  return updatePhase(id, patch);
}

export async function deletePhaseAction(id: string): Promise<void> {
  await deletePhase(id);
}

export async function reorderPhasesAction(
  narrativeId: string,
  ordering: PhaseReorderEntry[],
): Promise<void> {
  await reorderPhases(narrativeId, ordering);
}

export async function createWorkstreamAction(
  input: CreateWorkstreamInput,
): Promise<NarrativeWorkstream> {
  return createWorkstream(input);
}

export async function updateWorkstreamAction(
  id: string,
  patch: UpdateWorkstreamInput,
): Promise<NarrativeWorkstream> {
  return updateWorkstream(id, patch);
}

export async function deleteWorkstreamAction(id: string): Promise<void> {
  await deleteWorkstream(id);
}

export async function reorderWorkstreamsAction(
  narrativeId: string,
  ordering: WorkstreamReorderEntry[],
): Promise<void> {
  await reorderWorkstreams(narrativeId, ordering);
}

export async function createDependencyAction(
  input: CreateDependencyInput,
): Promise<NarrativeDependency> {
  const actor = await getActor();
  return createDependency({
    ...input,
    created_by: actor.email,
    updated_by: actor.email,
  });
}

export async function updateDependencyAction(
  id: string,
  patch: UpdateDependencyInput,
): Promise<NarrativeDependency> {
  const actor = await getActor();
  return updateDependency(id, { ...patch, updated_by: actor.email });
}

export async function deleteDependencyAction(id: string): Promise<void> {
  await deleteDependency(id);
}

export async function reorderDependenciesAction(
  narrativeId: string,
  ordering: DependencyReorderEntry[],
): Promise<void> {
  await reorderDependencies(narrativeId, ordering);
}

export async function createRiskAction(
  input: CreateRiskInput,
): Promise<NarrativeRisk> {
  const actor = await getActor();
  return createRisk({
    ...input,
    created_by: actor.email,
    updated_by: actor.email,
  });
}

export async function updateRiskAction(
  id: string,
  patch: UpdateRiskInput,
): Promise<NarrativeRisk> {
  const actor = await getActor();
  return updateRisk(id, { ...patch, updated_by: actor.email });
}

export async function deleteRiskAction(id: string): Promise<void> {
  await deleteRisk(id);
}

export async function reorderRisksAction(
  narrativeId: string,
  ordering: RiskReorderEntry[],
): Promise<void> {
  await reorderRisks(narrativeId, ordering);
}
