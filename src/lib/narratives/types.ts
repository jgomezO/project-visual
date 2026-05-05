// Public type surface for the narratives layer. Generated row/insert/update
// types are re-exported with friendlier names; composite shapes (a narrative
// with all its children) are assembled here so call sites don't reach into
// the generated module directly.

import type { Database } from "@/lib/supabase/types";

type NarrativeTables = Database["public"]["Tables"];

export type ProjectNarrative = NarrativeTables["project_narratives"]["Row"];
export type ProjectNarrativeInsert =
  NarrativeTables["project_narratives"]["Insert"];
export type ProjectNarrativeUpdate =
  NarrativeTables["project_narratives"]["Update"];

export type NarrativePhase = NarrativeTables["narrative_phases"]["Row"];
export type NarrativePhaseInsert =
  NarrativeTables["narrative_phases"]["Insert"];
export type NarrativePhaseUpdate =
  NarrativeTables["narrative_phases"]["Update"];

// `status` widens to string in the generated types because the CHECK
// constraint isn't introspected. Narrow on the boundary, in queries that
// hand rows to the UI.
export type PhaseStatus =
  | "completed"
  | "in_progress"
  | "upcoming"
  | "at_risk";

export type NarrativeWorkstream =
  NarrativeTables["narrative_workstreams"]["Row"];
export type NarrativeWorkstreamInsert =
  NarrativeTables["narrative_workstreams"]["Insert"];
export type NarrativeWorkstreamUpdate =
  NarrativeTables["narrative_workstreams"]["Update"];

// A phase with the workstreams that live under it, ordered by order_index.
export interface NarrativePhaseWithWorkstreams extends NarrativePhase {
  workstreams: NarrativeWorkstream[];
}

// Full read-shape for the detail view: narrative + ordered phases (each
// with its ordered workstreams) + workstreams whose phase_id is NULL
// ("orphans"), rendered alongside phases at the narrative root, plus
// the cross-team dependencies and the risks declared on the narrative.
export interface NarrativeWithChildren extends ProjectNarrative {
  phases: NarrativePhaseWithWorkstreams[];
  orphan_workstreams: NarrativeWorkstream[];
  dependencies: NarrativeDependency[];
  risks: NarrativeRisk[];
}

export type NarrativeDependency =
  NarrativeTables["narrative_dependencies"]["Row"];
export type NarrativeDependencyInsert =
  NarrativeTables["narrative_dependencies"]["Insert"];
export type NarrativeDependencyUpdate =
  NarrativeTables["narrative_dependencies"]["Update"];

// Like PhaseStatus, the CHECK on commitment_status doesn't reach the
// generated types — narrow at the boundary.
export type CommitmentStatus =
  | "proposed"
  | "agreed"
  | "confirmed"
  | "at_risk"
  | "blocked";

// Output of `deriveRiskLevel` (lib/narratives/derived.ts). Rendered in
// both the editor (small dot in the sidebar) and the public view
// (lateral border on the dependency card).
export type RiskLevel = "low" | "medium" | "high" | "critical";

export type NarrativeRisk = NarrativeTables["narrative_risks"]["Row"];
export type NarrativeRiskInsert =
  NarrativeTables["narrative_risks"]["Insert"];
export type NarrativeRiskUpdate =
  NarrativeTables["narrative_risks"]["Update"];

// Same role as PhaseStatus / CommitmentStatus: narrow at the boundary
// what the generated types widen to `string`.
export type RiskSeverity = "low" | "medium" | "high";
