import "server-only";
import { getAnonSupabase } from "@/lib/supabase/anon";
import type { StatusCategory } from "@/components/project/ProjectTable";
import type {
  NarrativePhaseWithWorkstreams,
  NarrativeWithChildren,
  NarrativeWorkstream,
} from "./types";

// Public read-shape for issues consumed by the public narrative view.
// Mirrors the columns we project from the `issues` table — no `raw` blob,
// no parent_id, no internal ids.
export interface IssuePublicData {
  key: string;
  summary: string;
  status_name: string | null;
  status_category: StatusCategory;
  due_date: string | null;
  assignee_display_name: string | null;
}

// Derived stats for a single workstream. `foundIssues` is the count we
// could resolve via the issues table; `missingKeys` are jira_issue_keys
// that didn't come back. `progress` is computed only over `foundIssues`
// — issues we don't know about don't contribute to a Done ratio we can't
// trust.
export interface WorkstreamDerived {
  totalKeys: number;
  foundIssues: number;
  missingKeys: string[];
  byCategory: Record<StatusCategory, number>;
  progress: number;
  overdueCount: number;
}

// Phase progress respects a manual `progress_percent` override; if null,
// it falls back to the simple average of its workstreams' computed
// progress. A phase with zero workstreams reports 0% and the UI hides
// the bar rather than showing a flat empty rail.
export interface PhaseDerived {
  workstreamCount: number;
  totalIssues: number;
  progress: number;
  hasManualProgress: boolean;
}

export interface NarrativeDerived {
  totalWorkstreams: number;
  totalIssues: number;
  globalProgress: number;
  perWorkstream: Map<string, WorkstreamDerived>;
  perPhase: Map<string, PhaseDerived>;
}

/**
 * Loads issue rows for every key referenced by the narrative's workstreams.
 * One IN() query, scoped to the narrative's project_id so a stale key
 * shared with a different project can't accidentally surface here.
 *
 * Returns a Map keyed by issue key. Keys that aren't in `issues` simply
 * don't appear — callers detect missing keys by Map.get(key) === undefined.
 */
export async function loadIssuesForNarrative(
  narrative: NarrativeWithChildren,
): Promise<Map<string, IssuePublicData>> {
  const keys = collectIssueKeys(narrative);
  if (keys.length === 0) return new Map();

  const supabase = getAnonSupabase();
  const { data, error } = await supabase
    .from("issues")
    .select("key, summary, status_name, status_category, due_date, assignee_display_name")
    .eq("project_id", narrative.project_id)
    .in("key", keys);
  if (error) throw error;

  const map = new Map<string, IssuePublicData>();
  for (const row of data ?? []) {
    map.set(row.key, {
      key: row.key,
      summary: row.summary,
      status_name: row.status_name,
      status_category: row.status_category as StatusCategory,
      due_date: row.due_date,
      assignee_display_name: row.assignee_display_name,
    });
  }
  return map;
}

/**
 * Pure computation over the loaded issues map. Returns Maps keyed by
 * workstream id and phase id so the renderer does an O(1) lookup per
 * card without re-walking the tree.
 */
export function computeDerived(
  narrative: NarrativeWithChildren,
  issuesByKey: Map<string, IssuePublicData>,
): NarrativeDerived {
  const today = todayISODate();

  const perWorkstream = new Map<string, WorkstreamDerived>();
  for (const ws of allWorkstreams(narrative)) {
    perWorkstream.set(ws.id, computeWorkstream(ws, issuesByKey, today));
  }

  const perPhase = new Map<string, PhaseDerived>();
  for (const phase of narrative.phases) {
    perPhase.set(phase.id, computePhase(phase, perWorkstream));
  }

  const totalWorkstreams = perWorkstream.size;
  let totalIssues = 0;
  let totalDone = 0;
  for (const w of perWorkstream.values()) {
    totalIssues += w.foundIssues;
    totalDone += w.byCategory.Done;
  }
  const globalProgress = totalIssues === 0 ? 0 : Math.round((totalDone / totalIssues) * 100);

  return {
    totalWorkstreams,
    totalIssues,
    globalProgress,
    perWorkstream,
    perPhase,
  };
}

function computeWorkstream(
  ws: NarrativeWorkstream,
  issuesByKey: Map<string, IssuePublicData>,
  today: string,
): WorkstreamDerived {
  const byCategory: Record<StatusCategory, number> = {
    "To Do": 0,
    "In Progress": 0,
    Done: 0,
  };
  const missingKeys: string[] = [];
  let overdueCount = 0;

  for (const key of ws.jira_issue_keys) {
    const issue = issuesByKey.get(key);
    if (!issue) {
      missingKeys.push(key);
      continue;
    }
    byCategory[issue.status_category]++;
    if (
      issue.due_date !== null &&
      issue.due_date < today &&
      issue.status_category !== "Done"
    ) {
      overdueCount++;
    }
  }

  const found =
    byCategory["To Do"] + byCategory["In Progress"] + byCategory.Done;
  const progress = found === 0 ? 0 : Math.round((byCategory.Done / found) * 100);

  return {
    totalKeys: ws.jira_issue_keys.length,
    foundIssues: found,
    missingKeys,
    byCategory,
    progress,
    overdueCount,
  };
}

function computePhase(
  phase: NarrativePhaseWithWorkstreams,
  perWorkstream: Map<string, WorkstreamDerived>,
): PhaseDerived {
  const wsDerived = phase.workstreams
    .map((w) => perWorkstream.get(w.id))
    .filter((d): d is WorkstreamDerived => d !== undefined);

  const totalIssues = wsDerived.reduce((sum, d) => sum + d.foundIssues, 0);

  if (phase.progress_percent !== null) {
    return {
      workstreamCount: phase.workstreams.length,
      totalIssues,
      progress: clamp(phase.progress_percent, 0, 100),
      hasManualProgress: true,
    };
  }

  const progress =
    wsDerived.length === 0
      ? 0
      : Math.round(
          wsDerived.reduce((sum, d) => sum + d.progress, 0) / wsDerived.length,
        );

  return {
    workstreamCount: phase.workstreams.length,
    totalIssues,
    progress,
    hasManualProgress: false,
  };
}

function collectIssueKeys(narrative: NarrativeWithChildren): string[] {
  const set = new Set<string>();
  for (const ws of allWorkstreams(narrative)) {
    for (const key of ws.jira_issue_keys) set.add(key);
  }
  return Array.from(set);
}

function* allWorkstreams(
  narrative: NarrativeWithChildren,
): Generator<NarrativeWorkstream> {
  for (const phase of narrative.phases) {
    for (const ws of phase.workstreams) yield ws;
  }
  for (const ws of narrative.orphan_workstreams) yield ws;
}

function todayISODate(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
