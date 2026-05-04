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
  issue_type: string;
}

// Minimal child shape used by the recursive progress walker. We don't
// need the full IssuePublicData here — just enough to decide leaf vs
// not-leaf and apply the Done check at leaves.
interface ChildIssue {
  key: string;
  status_category: StatusCategory;
}

// Output of the load step. Two indices:
// - issuesByKey: every loaded issue (direct + descendants), used by UI
//   look-ups via workstream.jira_issue_keys. The UI only renders what
//   the workstream listed; ancestors / descendants don't reach the
//   IssueChip.
// - childrenMap: parentKey → minimal child rows. Used by computeDerived
//   to walk the hierarchy when computing recursive progress.
export interface NarrativeIssueData {
  issuesByKey: Map<string, IssuePublicData>;
  childrenMap: Map<string, ChildIssue[]>;
}

// Derived stats for a single workstream. `foundIssues`, `byCategory`,
// `overdueCount` and `missingKeys` are about the *directly linked*
// issues (`workstream.jira_issue_keys`) — the ones the lay reader put
// into the workstream and expects to see. `progress` uses the recursive
// closure: a parent's progress folds in its children's leaf-level Done
// state. Issues missing from sync don't participate.
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
// progress. A phase with zero workstreams reports 0%.
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

// Hard cap for the recursive children fetch. Real Jira hierarchies max
// out at epic → story → task → sub-task (depth 3); 4 leaves headroom.
const MAX_HIERARCHY_DEPTH = 4;

/**
 * Loads every issue referenced (directly or transitively) by the
 * narrative's workstreams.
 *
 * Pass 0: SELECT * WHERE key IN (jira_issue_keys).
 * Pass 1..MAX_HIERARCHY_DEPTH: SELECT * WHERE parent_id IN (frontier ids,
 * minus already-loaded). Stops as soon as a pass returns no new rows.
 *
 * Parent → child relationships in the closure are reconstructed from
 * `parent_id` against an id→key map built during loading. The drawer
 * pattern uses two-step queries instead of PostgREST embeds; same
 * principle here. No `parent.key` resolution leaves the loaded set,
 * because by construction every parent we reference is already loaded.
 *
 * Total queries: 1 initial + up to MAX_HIERARCHY_DEPTH children passes.
 * For typical narratives (10–50 direct keys, 2–3 levels deep) we stop
 * after 2–3 children passes, so ~3–4 queries.
 */
export async function loadIssuesForNarrative(
  narrative: NarrativeWithChildren,
): Promise<NarrativeIssueData> {
  const initialKeys = collectIssueKeys(narrative);
  if (initialKeys.length === 0) {
    return { issuesByKey: new Map(), childrenMap: new Map() };
  }

  const supabase = getAnonSupabase();
  const SELECT =
    "id, key, summary, status_name, status_category, due_date, assignee_display_name, issue_type, parent_id";

  type LoadedRow = {
    id: string;
    key: string;
    summary: string;
    status_name: string | null;
    status_category: string;
    due_date: string | null;
    assignee_display_name: string | null;
    issue_type: string;
    parent_id: string | null;
  };

  const closure = new Map<string, LoadedRow>();
  const idToKey = new Map<string, string>();

  const first = await supabase
    .from("issues")
    .select(SELECT)
    .eq("project_id", narrative.project_id)
    .in("key", initialKeys);
  if (first.error) throw first.error;
  for (const row of (first.data ?? []) as LoadedRow[]) {
    closure.set(row.key, row);
    idToKey.set(row.id, row.key);
  }

  let frontierIds = ((first.data ?? []) as LoadedRow[]).map((r) => r.id);
  for (let depth = 0; depth < MAX_HIERARCHY_DEPTH && frontierIds.length > 0; depth++) {
    const next = await supabase
      .from("issues")
      .select(SELECT)
      .eq("project_id", narrative.project_id)
      .in("parent_id", frontierIds);
    if (next.error) throw next.error;

    const newIds: string[] = [];
    for (const row of (next.data ?? []) as LoadedRow[]) {
      if (closure.has(row.key)) continue;
      closure.set(row.key, row);
      idToKey.set(row.id, row.key);
      newIds.push(row.id);
    }
    if (newIds.length === 0) break;
    frontierIds = newIds;
  }

  const issuesByKey = new Map<string, IssuePublicData>();
  const childrenMap = new Map<string, ChildIssue[]>();
  for (const row of closure.values()) {
    const statusCategory = row.status_category as StatusCategory;
    issuesByKey.set(row.key, {
      key: row.key,
      summary: row.summary,
      status_name: row.status_name,
      status_category: statusCategory,
      due_date: row.due_date,
      assignee_display_name: row.assignee_display_name,
      issue_type: row.issue_type,
    });
    if (row.parent_id) {
      const parentKey = idToKey.get(row.parent_id);
      if (parentKey) {
        const list = childrenMap.get(parentKey) ?? [];
        list.push({ key: row.key, status_category: statusCategory });
        childrenMap.set(parentKey, list);
      }
    }
  }

  return { issuesByKey, childrenMap };
}

/**
 * Pure computation over the loaded issues + childrenMap. Returns Maps
 * keyed by workstream id and phase id so the renderer does an O(1)
 * lookup per card without re-walking the tree.
 *
 * globalProgress is the simple average of EVERY workstream's progress
 * (workstreams inside phases AND orphan workstreams), each weighted
 * equally. Example: phase with WS [100, 50, 0] + 1 orphan [50] →
 * (100+50+0+50)/4 = 50%. The phase is NOT a unit of weighting.
 */
export function computeDerived(
  narrative: NarrativeWithChildren,
  issuesByKey: Map<string, IssuePublicData>,
  childrenMap: Map<string, ChildIssue[]>,
): NarrativeDerived {
  const today = todayISODate();

  const perWorkstream = new Map<string, WorkstreamDerived>();
  for (const ws of allWorkstreams(narrative)) {
    perWorkstream.set(
      ws.id,
      computeWorkstream(ws, issuesByKey, childrenMap, today),
    );
  }

  const perPhase = new Map<string, PhaseDerived>();
  for (const phase of narrative.phases) {
    perPhase.set(phase.id, computePhase(phase, perWorkstream));
  }

  const totalWorkstreams = perWorkstream.size;
  const totalIssues = countUniqueFoundIssues(narrative, issuesByKey);

  const allProgresses = Array.from(perWorkstream.values()).map((w) => w.progress);
  const globalProgress =
    allProgresses.length === 0
      ? 0
      : Math.round(
          allProgresses.reduce((s, p) => s + p, 0) / allProgresses.length,
        );

  return {
    totalWorkstreams,
    totalIssues,
    globalProgress,
    perWorkstream,
    perPhase,
  };
}

/**
 * Recursive progress for a single issue.
 *
 * - Leaf (no loaded children): 100 if Done, else 0.
 * - Non-leaf: simple average of children's recursive progress.
 *
 * Children that *should* exist but weren't loaded (e.g. an epic with
 * stories not yet synced) make the issue appear as a leaf. Documented
 * as a known under-estimation in CLAUDE.md.
 *
 * `visited` guards against cycles. Jira parent_id can't form one in
 * practice, but a defensive set is cheap insurance and turns an
 * infinite loop into a single console.warn.
 */
function computeIssueProgress(
  key: string,
  statusCategory: StatusCategory,
  childrenMap: Map<string, ChildIssue[]>,
  visited: Set<string>,
): number {
  if (visited.has(key)) {
    console.warn(
      `[narrative-derived] cycle detected at ${key}; treating as leaf`,
    );
    return statusCategory === "Done" ? 100 : 0;
  }
  visited.add(key);

  const children = childrenMap.get(key) ?? [];
  if (children.length === 0) {
    return statusCategory === "Done" ? 100 : 0;
  }

  let sum = 0;
  for (const child of children) {
    sum += computeIssueProgress(
      child.key,
      child.status_category,
      childrenMap,
      visited,
    );
  }
  return sum / children.length;
}

function computeWorkstream(
  ws: NarrativeWorkstream,
  issuesByKey: Map<string, IssuePublicData>,
  childrenMap: Map<string, ChildIssue[]>,
  today: string,
): WorkstreamDerived {
  const byCategory: Record<StatusCategory, number> = {
    "To Do": 0,
    "In Progress": 0,
    Done: 0,
  };
  const missingKeys: string[] = [];
  let overdueCount = 0;
  const linked: IssuePublicData[] = [];

  for (const key of ws.jira_issue_keys) {
    const issue = issuesByKey.get(key);
    if (!issue) {
      missingKeys.push(key);
      continue;
    }
    linked.push(issue);
    byCategory[issue.status_category]++;
    if (
      issue.due_date !== null &&
      issue.due_date < today &&
      issue.status_category !== "Done"
    ) {
      overdueCount++;
    }
  }

  const progress =
    linked.length === 0
      ? 0
      : Math.round(
          linked.reduce(
            (sum, issue) =>
              sum +
              computeIssueProgress(
                issue.key,
                issue.status_category,
                childrenMap,
                new Set(),
              ),
            0,
          ) / linked.length,
        );

  return {
    totalKeys: ws.jira_issue_keys.length,
    foundIssues: linked.length,
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

function countUniqueFoundIssues(
  narrative: NarrativeWithChildren,
  issuesByKey: Map<string, IssuePublicData>,
): number {
  const seen = new Set<string>();
  for (const ws of allWorkstreams(narrative)) {
    for (const key of ws.jira_issue_keys) {
      if (issuesByKey.has(key)) seen.add(key);
    }
  }
  return seen.size;
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
