import "server-only";
import { getAnonSupabase } from "@/lib/supabase/anon";
import type {
  NarrativeDependency,
  NarrativePhase,
  NarrativePhaseWithWorkstreams,
  NarrativeWithChildren,
  NarrativeWorkstream,
  ProjectNarrative,
} from "./types";

// Narrative reads use the anon client — RLS is read-open and a service-role
// dependency would couple read code paths to a server-only secret unnecessarily.

/**
 * Lists every narrative for a project, ordered by published-first then
 * created_at desc (newest drafts above old ones). One round-trip; no
 * children eagerly loaded.
 */
export async function getNarrativesByProject(
  projectKey: string,
): Promise<ProjectNarrative[]> {
  const supabase = getAnonSupabase();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("key", projectKey)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return [];

  const { data, error } = await supabase
    .from("project_narratives")
    .select("*")
    .eq("project_id", project.id)
    .order("published", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Detail read for /projects/[key]/narrative. Two parallel queries:
 *   1. The narrative joined with all its phases and the workstreams that
 *      hang off each phase (PostgREST embed via the phase_id FK).
 *   2. Orphan workstreams (phase_id IS NULL) for the narrative root.
 *
 * The two-query split is intentional: PostgREST can't filter an embedded
 * resource by NULL on the join column without filtering the parent, and a
 * server-side RPC felt premature for a one-screen view. If this ever
 * becomes a hot path we'll fold it into a JSON-returning SQL function;
 * the call site stays the same.
 */
export async function getNarrativeById(
  id: string,
): Promise<NarrativeWithChildren | null> {
  const supabase = getAnonSupabase();

  const [main, orphans] = await Promise.all([
    supabase
      .from("project_narratives")
      .select(
        "*, phases:narrative_phases(*, workstreams:narrative_workstreams(*))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("narrative_workstreams")
      .select("*")
      .eq("narrative_id", id)
      .is("phase_id", null)
      .order("order_index", { ascending: true }),
  ]);

  if (main.error) throw main.error;
  if (orphans.error) throw orphans.error;
  if (!main.data) return null;

  return assembleNarrative(main.data, orphans.data ?? []);
}

/**
 * The first published narrative for the given project, fully hydrated.
 * "First" by created_at desc — i.e. the most recent published one wins.
 * Returns null if the project has none.
 */
export async function getPublishedNarrative(
  projectKey: string,
): Promise<NarrativeWithChildren | null> {
  const supabase = getAnonSupabase();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("key", projectKey)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return null;

  const { data, error } = await supabase
    .from("project_narratives")
    .select("id")
    .eq("project_id", project.id)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return getNarrativeById(data.id);
}

/**
 * Cross-team dependencies declared inside a narrative, ordered by
 * order_index. Read on the public preview alongside the narrative tree
 * (Wave 2 in the page's query schedule — see CLAUDE.md "Query waves").
 */
export async function getDependenciesByNarrative(
  narrativeId: string,
): Promise<NarrativeDependency[]> {
  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from("narrative_dependencies")
    .select("*")
    .eq("narrative_id", narrativeId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

interface NarrativeWithEmbeds extends ProjectNarrative {
  phases: (NarrativePhase & { workstreams: NarrativeWorkstream[] })[] | null;
}

function assembleNarrative(
  raw: NarrativeWithEmbeds,
  orphans: NarrativeWorkstream[],
): NarrativeWithChildren {
  const { phases: rawPhases, ...narrativeFields } = raw;
  const phases: NarrativePhaseWithWorkstreams[] = (rawPhases ?? [])
    .map((p) => ({
      ...p,
      workstreams: [...p.workstreams].sort(
        (a, b) => a.order_index - b.order_index,
      ),
    }))
    .sort((a, b) => a.order_index - b.order_index);

  return {
    ...narrativeFields,
    phases,
    orphan_workstreams: orphans,
  };
}
