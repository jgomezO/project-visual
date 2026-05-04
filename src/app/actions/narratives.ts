"use server";

import { revalidatePath } from "next/cache";
import {
  createDependency,
  createNarrative,
  createPhase,
  createWorkstream,
  deleteDependency,
  deleteNarrative,
  deletePhase,
  deleteWorkstream,
  duplicateNarrative,
  publishNarrative,
  reorderDependencies,
  reorderPhases,
  reorderWorkstreams,
  updateDependency,
  updateNarrative,
  updatePhase,
  updateWorkstream,
  type CreateDependencyInput,
  type CreateNarrativeInput,
  type CreatePhaseInput,
  type CreateWorkstreamInput,
  type DependencyReorderEntry,
  type PhaseReorderEntry,
  type UpdateDependencyInput,
  type UpdateNarrativeInput,
  type UpdatePhaseInput,
  type UpdateWorkstreamInput,
  type WorkstreamReorderEntry,
} from "@/lib/narratives/mutations";
import type {
  NarrativeDependency,
  NarrativePhase,
  NarrativeWorkstream,
  ProjectNarrative,
} from "@/lib/narratives/types";

// All mutations route through Server Actions so secrets stay on the server
// and Client Components can `await` them directly without an HTTP layer.
//
// `revalidatePath` is fired only on actions whose result changes the list
// page (`/projects/[key]/narratives`). Editor-side actions skip the
// revalidation because the editor is already a Client tree-state owner —
// the form receives the returned entity and patches in place.

export async function createNarrativeAction(
  projectKey: string,
  input: CreateNarrativeInput,
): Promise<ProjectNarrative> {
  const created = await createNarrative(input);
  revalidatePath(`/projects/${projectKey}/narratives`);
  return created;
}

export async function updateNarrativeAction(
  id: string,
  patch: UpdateNarrativeInput,
): Promise<ProjectNarrative> {
  return updateNarrative(id, patch);
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
  const copy = await duplicateNarrative(sourceId);
  revalidatePath(`/projects/${projectKey}/narratives`);
  return copy;
}

export async function publishNarrativeAction(
  projectKey: string,
  id: string,
  published: boolean,
): Promise<ProjectNarrative> {
  const updated = await publishNarrative(id, published);
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
  return createDependency(input);
}

export async function updateDependencyAction(
  id: string,
  patch: UpdateDependencyInput,
): Promise<NarrativeDependency> {
  return updateDependency(id, patch);
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
