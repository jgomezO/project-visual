import "server-only";
import { getServiceSupabase } from "@/lib/supabase/service";
import type {
  NarrativePhase,
  NarrativePhaseInsert,
  NarrativePhaseUpdate,
  NarrativeWorkstream,
  NarrativeWorkstreamInsert,
  NarrativeWorkstreamUpdate,
  ProjectNarrative,
  ProjectNarrativeInsert,
  ProjectNarrativeUpdate,
} from "./types";

// All writes go through the service role — RLS is read-open and we want
// the writers in one server-only place rather than a policy-per-shape grid.
// When user auth lands, RLS will drive writes and these helpers will swap
// to the anon client gated by JWT.

export type CreateNarrativeInput = Omit<
  ProjectNarrativeInsert,
  "id" | "created_at" | "updated_at"
>;
export type UpdateNarrativeInput = Omit<
  ProjectNarrativeUpdate,
  "id" | "project_id" | "created_at" | "updated_at"
>;

export type CreatePhaseInput = Omit<
  NarrativePhaseInsert,
  "id" | "created_at" | "updated_at"
>;
export type UpdatePhaseInput = Omit<
  NarrativePhaseUpdate,
  "id" | "narrative_id" | "created_at" | "updated_at"
>;

export type CreateWorkstreamInput = Omit<
  NarrativeWorkstreamInsert,
  "id" | "created_at" | "updated_at"
>;
export type UpdateWorkstreamInput = Omit<
  NarrativeWorkstreamUpdate,
  "id" | "narrative_id" | "created_at" | "updated_at"
>;

export interface WorkstreamReorderEntry {
  id: string;
  phase_id: string | null;
  order_index: number;
}

// ----------------------------------------------------------------------------
// project_narratives
// ----------------------------------------------------------------------------

export async function createNarrative(
  input: CreateNarrativeInput,
): Promise<ProjectNarrative> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("project_narratives")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateNarrative(
  id: string,
  input: UpdateNarrativeInput,
): Promise<ProjectNarrative> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("project_narratives")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNarrative(id: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("project_narratives")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// narrative_phases
// ----------------------------------------------------------------------------

export async function createPhase(
  input: CreatePhaseInput,
): Promise<NarrativePhase> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("narrative_phases")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePhase(
  id: string,
  input: UpdatePhaseInput,
): Promise<NarrativePhase> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("narrative_phases")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePhase(id: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("narrative_phases")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ----------------------------------------------------------------------------
// narrative_workstreams
// ----------------------------------------------------------------------------

export async function createWorkstream(
  input: CreateWorkstreamInput,
): Promise<NarrativeWorkstream> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("narrative_workstreams")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorkstream(
  id: string,
  input: UpdateWorkstreamInput,
): Promise<NarrativeWorkstream> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("narrative_workstreams")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorkstream(id: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("narrative_workstreams")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Atomic reorder for the upcoming drag-and-drop UI. Assigns a new
 * (phase_id, order_index) to each listed workstream within `narrativeId`.
 *
 * Atomicity comes from a single PostgREST upsert: supabase-js batches all
 * rows into one HTTP request, which PostgREST runs inside a single
 * transaction — partial failures roll back the whole batch. The previous
 * row state is fetched first so the upsert payload carries every column
 * (PostgREST replaces conflicting rows in full); the moddatetime trigger
 * then refreshes updated_at on each row.
 *
 * Refuses to touch workstreams that don't belong to `narrativeId` so a
 * mis-targeted call can't accidentally cross-link narratives.
 */
export async function reorderWorkstreams(
  narrativeId: string,
  ordering: WorkstreamReorderEntry[],
): Promise<void> {
  if (ordering.length === 0) return;
  const supabase = getServiceSupabase();

  const ids = ordering.map((o) => o.id);
  const { data: existing, error: fetchError } = await supabase
    .from("narrative_workstreams")
    .select("*")
    .in("id", ids);
  if (fetchError) throw fetchError;

  const byId = new Map<string, NarrativeWorkstream>(
    (existing ?? []).map((r) => [r.id, r]),
  );

  if (byId.size !== ordering.length) {
    const missing = ordering
      .map((o) => o.id)
      .filter((id) => !byId.has(id));
    throw new Error(
      `reorderWorkstreams: ${missing.length} id(s) not found: ${missing.join(", ")}`,
    );
  }

  const wrongNarrative = ordering.filter(
    (o) => byId.get(o.id)?.narrative_id !== narrativeId,
  );
  if (wrongNarrative.length > 0) {
    throw new Error(
      `reorderWorkstreams: ${wrongNarrative.length} workstream(s) do not belong to narrative ${narrativeId}`,
    );
  }

  const next = ordering.map((o) => {
    const row = byId.get(o.id)!;
    return {
      ...row,
      phase_id: o.phase_id,
      order_index: o.order_index,
    };
  });

  const { error: upsertError } = await supabase
    .from("narrative_workstreams")
    .upsert(next, { onConflict: "id" });
  if (upsertError) throw upsertError;
}
