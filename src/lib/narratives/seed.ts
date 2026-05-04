// Dev-only seeder. Run via `pnpm seed:narrative`.
//
// Intentionally does NOT import "@/lib/supabase/service" or "server-only":
// both rely on Next.js bundler semantics that the tsx-based script doesn't
// have. The seed builds its own service-role client inline so the rest of
// the narratives module stays guarded for the app build.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  NarrativePhase,
  NarrativeWorkstream,
  ProjectNarrative,
} from "./types";

// Sentinel title used to detect an already-seeded narrative. Changing this
// breaks idempotency for existing local databases — pick a stable value.
const DEMO_TITLE = "Ticketing V2 - Demo Narrative";
const DEMO_PROJECT_KEY = "NOXSCRUM";

export interface SeedOutcome {
  alreadyExisted: boolean;
  narrative: ProjectNarrative;
  phases: NarrativePhase[];
  workstreams: NarrativeWorkstream[];
}

function getSeedClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      "seedDevNarrative: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env",
    );
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Idempotent: if a narrative with DEMO_TITLE already exists for the demo
 * project, returns it as-is without touching anything (no reconciliation
 * of phases / workstreams). Otherwise creates the narrative + 2 phases +
 * 3 workstreams (2 inside Phase 0, 1 orphan at the narrative root).
 *
 * For development use only. Not exported from index.ts.
 */
export async function seedDevNarrative(): Promise<SeedOutcome> {
  const supabase = getSeedClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, key")
    .eq("key", DEMO_PROJECT_KEY)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) {
    throw new Error(
      `seedDevNarrative: project ${DEMO_PROJECT_KEY} not found. Run a sync first.`,
    );
  }

  const { data: existing, error: existingError } = await supabase
    .from("project_narratives")
    .select("id")
    .eq("project_id", project.id)
    .eq("title", DEMO_TITLE)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing) {
    const [narRes, phasesRes, wsRes] = await Promise.all([
      supabase
        .from("project_narratives")
        .select("*")
        .eq("id", existing.id)
        .single(),
      supabase
        .from("narrative_phases")
        .select("*")
        .eq("narrative_id", existing.id)
        .order("order_index"),
      supabase
        .from("narrative_workstreams")
        .select("*")
        .eq("narrative_id", existing.id)
        .order("order_index"),
    ]);
    if (narRes.error) throw narRes.error;
    if (phasesRes.error) throw phasesRes.error;
    if (wsRes.error) throw wsRes.error;
    return {
      alreadyExisted: true,
      narrative: narRes.data,
      phases: phasesRes.data ?? [],
      workstreams: wsRes.data ?? [],
    };
  }

  // The demo workstreams reference real synced issues so the eventual UI
  // has live data to hydrate. There is no FK to issues by design — if a
  // future sync removes a key, the seed still inserts cleanly.
  const issueKeysPhase0a = ["NOXSCRUM-907"];
  const issueKeysPhase0b = ["NOXSCRUM-908"];
  const issueKeysOrphan = ["NOXSCRUM-1039"];

  const { data: narrative, error: nErr } = await supabase
    .from("project_narratives")
    .insert({
      project_id: project.id,
      title: DEMO_TITLE,
      subtitle: "Snapshot for the iter 4b UI to render against",
      overview:
        "Demo narrative for the development environment. Replaced by real PM-authored content once the editor lands.",
      status_summary:
        "Phase 0 validation in progress. Implementation kicks off once the modal flow is signed off.",
      published: false,
      created_by: "system",
      updated_by: "system",
    })
    .select()
    .single();
  if (nErr) throw nErr;

  const { data: phases, error: pErr } = await supabase
    .from("narrative_phases")
    .insert([
      {
        narrative_id: narrative.id,
        order_index: 0,
        name: "Phase 0 - Validación",
        objective: "Validar el flujo crítico de modales con stakeholders.",
        rationale: "Reduce el riesgo de retrabajo en Phase 1.",
        status: "in_progress",
        progress_percent: 60,
        start_date: "2026-04-15",
        end_date: "2026-05-15",
      },
      {
        narrative_id: narrative.id,
        order_index: 1,
        name: "Phase 1 - Implementación",
        objective: "Construir la integración POS / Salesforce end-to-end.",
        rationale:
          "El módulo de eventos es la entrada de datos del nuevo flujo de fundraising.",
        status: "upcoming",
        progress_percent: null,
        start_date: "2026-05-13",
        end_date: "2026-06-30",
      },
    ])
    .select()
    .order("order_index");
  if (pErr) throw pErr;
  const [phase0, phase1] = phases ?? [];
  if (!phase0 || !phase1) throw new Error("seed: phases insert returned wrong shape");

  const { data: workstreams, error: wErr } = await supabase
    .from("narrative_workstreams")
    .insert([
      {
        narrative_id: narrative.id,
        phase_id: phase0.id,
        order_index: 0,
        name: "Salesforce authentication",
        description:
          "Conectar el portal con Salesforce vía OAuth y resolver el refresh-token loop.",
        jira_issue_keys: issueKeysPhase0a,
      },
      {
        narrative_id: narrative.id,
        phase_id: phase0.id,
        order_index: 1,
        name: "Modal validation",
        description:
          "Cubrir los casos borde del modal de creación de eventos en el portal.",
        jira_issue_keys: issueKeysPhase0b,
      },
      {
        narrative_id: narrative.id,
        phase_id: null,
        order_index: 0,
        name: "Cross-cutting infra",
        description:
          "Trabajo transversal a las phases — observabilidad, deploys, feature flags.",
        jira_issue_keys: issueKeysOrphan,
      },
    ])
    .select();
  if (wErr) throw wErr;

  return {
    alreadyExisted: false,
    narrative,
    phases: [phase0, phase1],
    workstreams: workstreams ?? [],
  };
}
