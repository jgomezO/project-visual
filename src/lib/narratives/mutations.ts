import "server-only";
import { getServiceSupabase } from "@/lib/supabase/service";
import type {
  NarrativeDependency,
  NarrativeDependencyInsert,
  NarrativeDependencyUpdate,
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

export interface PhaseReorderEntry {
  id: string;
  order_index: number;
}

export type CreateDependencyInput = Omit<
  NarrativeDependencyInsert,
  "id" | "created_at" | "updated_at"
>;
export type UpdateDependencyInput = Omit<
  NarrativeDependencyUpdate,
  "id" | "narrative_id" | "created_at" | "updated_at"
>;

export interface DependencyReorderEntry {
  id: string;
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

/**
 * Best-effort copy: reads the source narrative + its phases + workstreams,
 * recreates them under a new narrative id with mapped phase_ids. NOT atomic
 * across tables (PostgREST + supabase-js cannot open a cross-statement
 * transaction without a SQL function). On any failure mid-way, the partial
 * narrative is deleted so the cascade cleans up — no zombies left behind.
 *
 * If this becomes a hot path or partial failures get common, fold into a
 * SQL function (`duplicate_narrative(p_id uuid)`) and switch the call site.
 */
export async function duplicateNarrative(
  sourceId: string,
): Promise<ProjectNarrative> {
  const supabase = getServiceSupabase();

  const sourceRes = await supabase
    .from("project_narratives")
    .select("*")
    .eq("id", sourceId)
    .single();
  if (sourceRes.error) throw sourceRes.error;
  const source = sourceRes.data;

  const insertRes = await supabase
    .from("project_narratives")
    .insert({
      project_id: source.project_id,
      title: `Copia de ${source.title}`,
      subtitle: source.subtitle,
      overview: source.overview,
      status_summary: source.status_summary,
      published: false,
      created_by: source.created_by,
      updated_by: source.updated_by,
    })
    .select()
    .single();
  if (insertRes.error) throw insertRes.error;
  const copy = insertRes.data;

  try {
    const phasesRes = await supabase
      .from("narrative_phases")
      .select("*")
      .eq("narrative_id", sourceId)
      .order("order_index");
    if (phasesRes.error) throw phasesRes.error;
    const sourcePhases = phasesRes.data ?? [];

    const phaseIdMap = new Map<string, string>();
    if (sourcePhases.length > 0) {
      const phaseInsert = await supabase
        .from("narrative_phases")
        .insert(
          sourcePhases.map((p) => ({
            narrative_id: copy.id,
            order_index: p.order_index,
            name: p.name,
            objective: p.objective,
            rationale: p.rationale,
            status: p.status,
            progress_percent: p.progress_percent,
            start_date: p.start_date,
            end_date: p.end_date,
          })),
        )
        .select();
      if (phaseInsert.error) throw phaseInsert.error;
      const newPhases = phaseInsert.data ?? [];
      // Match by (order_index, name) — both are stable in this insert.
      for (const original of sourcePhases) {
        const match = newPhases.find(
          (p) =>
            p.order_index === original.order_index &&
            p.name === original.name,
        );
        if (match) phaseIdMap.set(original.id, match.id);
      }
    }

    const workstreamsRes = await supabase
      .from("narrative_workstreams")
      .select("*")
      .eq("narrative_id", sourceId)
      .order("order_index");
    if (workstreamsRes.error) throw workstreamsRes.error;
    const sourceWorkstreams = workstreamsRes.data ?? [];

    if (sourceWorkstreams.length > 0) {
      const wsInsert = await supabase.from("narrative_workstreams").insert(
        sourceWorkstreams.map((w) => ({
          narrative_id: copy.id,
          phase_id: w.phase_id ? (phaseIdMap.get(w.phase_id) ?? null) : null,
          order_index: w.order_index,
          name: w.name,
          description: w.description,
          jira_issue_keys: w.jira_issue_keys,
        })),
      );
      if (wsInsert.error) throw wsInsert.error;
    }

    return copy;
  } catch (err) {
    // Cleanup the partial copy. CASCADE removes any phases / workstreams
    // that did succeed before the failure.
    await supabase.from("project_narratives").delete().eq("id", copy.id);
    throw err;
  }
}

export async function publishNarrative(
  id: string,
  published: boolean,
): Promise<ProjectNarrative> {
  return updateNarrative(id, { published });
}

/**
 * Atomic reorder for phases via single batch upsert. Same pattern as
 * reorderWorkstreams: fetch full rows, overwrite (order_index, ...rest),
 * upsert as one batch. PostgREST runs the batch in a single transaction.
 */
export async function reorderPhases(
  narrativeId: string,
  ordering: PhaseReorderEntry[],
): Promise<void> {
  if (ordering.length === 0) return;
  const supabase = getServiceSupabase();

  const ids = ordering.map((o) => o.id);
  const { data: existing, error: fetchError } = await supabase
    .from("narrative_phases")
    .select("*")
    .in("id", ids);
  if (fetchError) throw fetchError;

  const byId = new Map<string, NarrativePhase>(
    (existing ?? []).map((r) => [r.id, r]),
  );
  if (byId.size !== ordering.length) {
    const missing = ordering.map((o) => o.id).filter((id) => !byId.has(id));
    throw new Error(
      `reorderPhases: ${missing.length} id(s) not found: ${missing.join(", ")}`,
    );
  }
  const wrongNarrative = ordering.filter(
    (o) => byId.get(o.id)?.narrative_id !== narrativeId,
  );
  if (wrongNarrative.length > 0) {
    throw new Error(
      `reorderPhases: ${wrongNarrative.length} phase(s) do not belong to narrative ${narrativeId}`,
    );
  }

  const next = ordering.map((o) => {
    const row = byId.get(o.id)!;
    return { ...row, order_index: o.order_index };
  });

  const { error: upsertError } = await supabase
    .from("narrative_phases")
    .upsert(next, { onConflict: "id" });
  if (upsertError) throw upsertError;
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

// ----------------------------------------------------------------------------
// narrative_dependencies
// ----------------------------------------------------------------------------

export async function createDependency(
  input: CreateDependencyInput,
): Promise<NarrativeDependency> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("narrative_dependencies")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDependency(
  id: string,
  input: UpdateDependencyInput,
): Promise<NarrativeDependency> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from("narrative_dependencies")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDependency(id: string): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from("narrative_dependencies")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Atomic reorder for narrative dependencies. Same single-transaction
 * upsert pattern as reorderPhases / reorderWorkstreams: fetch existing
 * rows, overwrite order_index, batch upsert. Refuses to touch
 * dependencies outside `narrativeId`.
 */
export async function reorderDependencies(
  narrativeId: string,
  ordering: DependencyReorderEntry[],
): Promise<void> {
  if (ordering.length === 0) return;
  const supabase = getServiceSupabase();

  const ids = ordering.map((o) => o.id);
  const { data: existing, error: fetchError } = await supabase
    .from("narrative_dependencies")
    .select("*")
    .in("id", ids);
  if (fetchError) throw fetchError;

  const byId = new Map<string, NarrativeDependency>(
    (existing ?? []).map((r) => [r.id, r]),
  );
  if (byId.size !== ordering.length) {
    const missing = ordering.map((o) => o.id).filter((id) => !byId.has(id));
    throw new Error(
      `reorderDependencies: ${missing.length} id(s) not found: ${missing.join(", ")}`,
    );
  }
  const wrongNarrative = ordering.filter(
    (o) => byId.get(o.id)?.narrative_id !== narrativeId,
  );
  if (wrongNarrative.length > 0) {
    throw new Error(
      `reorderDependencies: ${wrongNarrative.length} dependency(ies) do not belong to narrative ${narrativeId}`,
    );
  }

  const next = ordering.map((o) => {
    const row = byId.get(o.id)!;
    return { ...row, order_index: o.order_index };
  });

  const { error: upsertError } = await supabase
    .from("narrative_dependencies")
    .upsert(next, { onConflict: "id" });
  if (upsertError) throw upsertError;
}
