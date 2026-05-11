import "server-only";
import { getAnonSupabase } from "@/lib/supabase/anon";
import type { StatusCategory } from "@/components/project/ProjectTable";
import type {
  CommitmentStatus,
  NarrativeDependency,
  NarrativePhaseWithWorkstreams,
  NarrativeWithChildren,
  NarrativeWorkstream,
  RiskLevel,
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
  // iter 9a: ISO timestamp when this issue was tombstoned by sync, or
  // null while it's still active in Jira. Surfaces visually in
  // IssueChip / WorkstreamCard / DependencyCard.
  deleted_at: string | null;
}

// Minimal child shape used by the recursive progress walker. We don't
// need the full IssuePublicData here — just enough to decide leaf vs
// not-leaf and apply the Done check at leaves.
interface ChildIssue {
  key: string;
  status_category: StatusCategory;
  // iter 9a: deleted children are skipped by computeIssueProgress so
  // a tombstoned descendant never contributes to its parent's average.
  deleted_at: string | null;
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
// state. Issues missing from sync OR tombstoned by sync don't
// participate in any of those numbers — but `deletedKeys` surfaces the
// latter separately so the UI can show "5 issues (1 deleted)" without
// conflating "never synced" and "deleted in Jira".
export interface WorkstreamDerived {
  totalKeys: number;
  foundIssues: number;
  missingKeys: string[];
  // iter 9a: keys that exist in our DB but have a non-null deleted_at.
  // Disjoint from missingKeys (those were never synced at all).
  deletedKeys: string[];
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

export type AggregateStatus =
  | "not_started"
  | "in_progress"
  | "mostly_done"
  | "done";

export interface ProviderIssuesData {
  found: IssuePublicData[];
  missing: string[];
  // iter 9a: third bucket — provider issues we KNOW were deleted in
  // Jira (distinct from "missing" = never synced). Excluded from
  // aggregateProgress / aggregateStatus so a tombstoned issue can't
  // distort the dependency's risk picture.
  deleted: IssuePublicData[];
  aggregateProgress: number;
  aggregateStatus: AggregateStatus;
}

// Derived stats for a single narrative_dependency. delayRiskDays is the
// signed delta in days between expected and needed: positive = the
// provider is going to be late, zero = on time, negative = arriving
// before we need it. `resolvedExpectedDeliveryDate` includes the
// fallback to the max provider-issue due_date when the manual date is
// blank.
export interface DependencyDerived {
  daysUntilNeeded: number | null;
  daysUntilDelivery: number | null;
  delayRiskDays: number | null;
  resolvedExpectedDeliveryDate: string | null;
  providerIssuesData: ProviderIssuesData;
  riskLevel: RiskLevel;
}

export interface NarrativeDerived {
  totalWorkstreams: number;
  totalIssues: number;
  globalProgress: number;
  perWorkstream: Map<string, WorkstreamDerived>;
  perPhase: Map<string, PhaseDerived>;
  perDependency: Map<string, DependencyDerived>;
  // Count of dependencies whose riskLevel resolves to "critical".
  // Convenience for the header banner.
  criticalDependencyCount: number;
}

// Hard cap for the recursive children fetch. Real Jira hierarchies max
// out at epic → story → task → sub-task (depth 3); 4 leaves headroom.
const MAX_HIERARCHY_DEPTH = 4;

/**
 * Loads every issue referenced (directly or transitively) by the
 * narrative's workstreams *and* by the provider side of its
 * dependencies.
 *
 * Pass 0: SELECT * WHERE key IN (workstream keys ∪ provider keys).
 * Pass 1..MAX_HIERARCHY_DEPTH: SELECT * WHERE parent_id IN (frontier ids,
 * minus already-loaded). Stops as soon as a pass returns no new rows.
 *
 * Note: queries are NOT scoped by `project_id` because dependencies
 * point at issues in *other* projects. Jira keys are unique within a
 * tenant, so a global IN() over keys is safe. Recursive children also
 * cross project boundaries (an Epic in the provider project may have
 * child stories in that same provider project — we want their leaves
 * for accurate progress).
 *
 * Parent → child relationships in the closure are reconstructed from
 * `parent_id` against an id→key map built during loading. Mirrors the
 * IssueDrawer pattern.
 *
 * Total queries: 1 initial + up to MAX_HIERARCHY_DEPTH children passes.
 * Typical narratives stop after 2–3 children passes — ~3–4 queries.
 */
export async function loadIssuesForNarrative(
  narrative: NarrativeWithChildren,
): Promise<NarrativeIssueData> {
  const initialKeys = collectIssueKeys(narrative);
  if (initialKeys.length === 0) {
    return { issuesByKey: new Map(), childrenMap: new Map() };
  }

  const supabase = getAnonSupabase();
  // iter 9a: `deleted_at` flows through to IssuePublicData + ChildIssue
  // so the public view can surface deleted issues with a visual marker
  // without re-querying.
  const SELECT =
    "id, key, summary, status_name, status_category, due_date, assignee_display_name, issue_type, parent_id, deleted_at";

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
    deleted_at: string | null;
  };

  const closure = new Map<string, LoadedRow>();
  const idToKey = new Map<string, string>();

  const first = await supabase
    .from("issues")
    .select(SELECT)
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
      deleted_at: row.deleted_at,
    });
    if (row.parent_id) {
      const parentKey = idToKey.get(row.parent_id);
      if (parentKey) {
        const list = childrenMap.get(parentKey) ?? [];
        list.push({
          key: row.key,
          status_category: statusCategory,
          deleted_at: row.deleted_at,
        });
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
  const todayMs = Date.parse(`${today}T00:00:00Z`);

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

  const perDependency = new Map<string, DependencyDerived>();
  let criticalDependencyCount = 0;
  for (const dep of narrative.dependencies) {
    const d = computeDependencyDerived(dep, issuesByKey, childrenMap, todayMs);
    perDependency.set(dep.id, d);
    if (d.riskLevel === "critical") criticalDependencyCount++;
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
    perDependency,
    criticalDependencyCount,
  };
}

/**
 * Risk level rules. Precedence top to bottom — first matching rule wins.
 *
 * 1. blocked → critical (regardless of dates)
 * 2. delayRiskDays > 14 AND status fragile (at_risk | proposed) → critical
 * 3. delayRiskDays > 7  OR status === at_risk                  → high
 * 4. 0 < delayRiskDays ≤ 7 OR status === proposed              → medium
 * 5. otherwise                                                  → low
 *
 * When `delayRiskDays` is null (one or both dates missing), the
 * date-based clauses fall through and the status alone drives the
 * level: blocked → critical, at_risk → high, proposed → medium,
 * agreed/confirmed → low.
 */
export function deriveRiskLevel(input: {
  delayRiskDays: number | null;
  commitmentStatus: CommitmentStatus;
}): RiskLevel {
  const { delayRiskDays, commitmentStatus } = input;
  if (commitmentStatus === "blocked") return "critical";
  if (
    delayRiskDays !== null &&
    delayRiskDays > 14 &&
    (commitmentStatus === "at_risk" || commitmentStatus === "proposed")
  ) {
    return "critical";
  }
  if (
    (delayRiskDays !== null && delayRiskDays > 7) ||
    commitmentStatus === "at_risk"
  ) {
    return "high";
  }
  if (
    (delayRiskDays !== null && delayRiskDays > 0 && delayRiskDays <= 7) ||
    commitmentStatus === "proposed"
  ) {
    return "medium";
  }
  return "low";
}

function computeDependencyDerived(
  dep: NarrativeDependency,
  issuesByKey: Map<string, IssuePublicData>,
  childrenMap: Map<string, ChildIssue[]>,
  todayMs: number,
): DependencyDerived {
  // Provider issues breakdown — three buckets after iter 9a:
  //   * found    → in DB, deleted_at null
  //   * deleted  → in DB, deleted_at set (still listed in the dep but
  //                gone upstream; surfaces with a tombstone marker)
  //   * missing  → never synced
  const found: IssuePublicData[] = [];
  const missing: string[] = [];
  const deleted: IssuePublicData[] = [];
  for (const key of dep.provider_jira_issue_keys) {
    const issue = issuesByKey.get(key);
    if (!issue) {
      missing.push(key);
      continue;
    }
    if (issue.deleted_at !== null) {
      deleted.push(issue);
      continue;
    }
    found.push(issue);
  }

  const aggregateProgress =
    found.length === 0
      ? 0
      : Math.round(
          found.reduce(
            (sum, issue) =>
              sum +
              computeIssueProgress(
                issue.key,
                issue.status_category,
                childrenMap,
                new Set(),
              ),
            0,
          ) / found.length,
        );

  const aggregateStatus: AggregateStatus =
    aggregateProgress === 0
      ? "not_started"
      : aggregateProgress >= 100
        ? "done"
        : aggregateProgress >= 70
          ? "mostly_done"
          : "in_progress";

  // Date math (UTC, day granularity).
  const daysUntilNeeded = daysFromTo(todayMs, dep.needed_by_date);
  const resolvedExpectedDeliveryDate =
    dep.expected_delivery_date ?? deriveProviderMaxDueDate(found);
  const daysUntilDelivery = daysFromTo(todayMs, resolvedExpectedDeliveryDate);
  const delayRiskDays =
    daysUntilNeeded === null || daysUntilDelivery === null
      ? null
      : daysUntilDelivery - daysUntilNeeded;

  const riskLevel = deriveRiskLevel({
    delayRiskDays,
    commitmentStatus: dep.commitment_status as CommitmentStatus,
  });

  return {
    daysUntilNeeded,
    daysUntilDelivery,
    delayRiskDays,
    resolvedExpectedDeliveryDate,
    providerIssuesData: {
      found,
      missing,
      deleted,
      aggregateProgress,
      aggregateStatus,
    },
    riskLevel,
  };
}

function deriveProviderMaxDueDate(
  found: IssuePublicData[],
): string | null {
  let max: string | null = null;
  for (const issue of found) {
    if (issue.due_date === null) continue;
    if (max === null || issue.due_date > max) max = issue.due_date;
  }
  return max;
}

function daysFromTo(todayMs: number, isoDate: string | null): number | null {
  if (!isoDate) return null;
  const t = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return Math.round((t - todayMs) / 86_400_000);
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

  // iter 9a: tombstoned children are filtered out — they neither
  // contribute to the parent's average nor make it look like a non-leaf
  // when they're the only descendants left. A parent whose only loaded
  // children are deleted reverts to leaf treatment based on its own
  // status, which is the most honest fallback.
  const children = (childrenMap.get(key) ?? []).filter(
    (c) => c.deleted_at === null,
  );
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
  // iter 9a: third bucket — keys whose row exists but `deleted_at` is
  // set. Excluded from byCategory / overdueCount / progress, surfaced
  // separately for the "5 issues (1 deleted)" affordance in
  // WorkstreamCard.
  const deletedKeys: string[] = [];
  let overdueCount = 0;
  const linked: IssuePublicData[] = [];

  for (const key of ws.jira_issue_keys) {
    const issue = issuesByKey.get(key);
    if (!issue) {
      missingKeys.push(key);
      continue;
    }
    if (issue.deleted_at !== null) {
      deletedKeys.push(key);
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
    deletedKeys,
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
      const issue = issuesByKey.get(key);
      // iter 9a: deleted issues count as zero against the global
      // "X issues" header — same standard the per-workstream
      // foundIssues count already applies.
      if (issue && issue.deleted_at === null) seen.add(key);
    }
  }
  return seen.size;
}

function collectIssueKeys(narrative: NarrativeWithChildren): string[] {
  const set = new Set<string>();
  for (const ws of allWorkstreams(narrative)) {
    for (const key of ws.jira_issue_keys) set.add(key);
  }
  for (const dep of narrative.dependencies) {
    for (const key of dep.provider_jira_issue_keys) set.add(key);
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
