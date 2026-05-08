import { describe, expect, it, vi } from "vitest";

import {
  computeDerived,
  deriveRiskLevel,
  type IssuePublicData,
} from "./derived";
import type {
  NarrativeDependency,
  NarrativePhaseWithWorkstreams,
  NarrativeWithChildren,
  NarrativeWorkstream,
} from "./types";

// --- Minimal builders -------------------------------------------------
//
// computeDerived only reads structural fields (workstreams, phases,
// dependencies, jira_issue_keys, progress_percent, status_category,
// due_date). The Supabase Row types ship many more nullable columns
// the function never touches; instead of populating all of them, the
// builders cast through `as unknown as ...` so tests can stay compact.
// If the function starts reading a new field, the cast still passes
// type-check but the test will fail until the builder gains the field.

type StatusCategory = "To Do" | "In Progress" | "Done";

function makeWS(
  overrides: { id: string; jira_issue_keys: string[] } & Partial<{
    name: string;
    phase_id: string | null;
    order_index: number;
  }>,
): NarrativeWorkstream {
  return {
    id: overrides.id,
    narrative_id: "n1",
    phase_id: overrides.phase_id ?? null,
    order_index: overrides.order_index ?? 0,
    name: overrides.name ?? `WS ${overrides.id}`,
    description: null,
    jira_issue_keys: overrides.jira_issue_keys,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as unknown as NarrativeWorkstream;
}

function makePhase(
  overrides: {
    id: string;
    workstreams: NarrativeWorkstream[];
  } & Partial<{
    progress_percent: number | null;
    name: string;
    order_index: number;
  }>,
): NarrativePhaseWithWorkstreams {
  return {
    id: overrides.id,
    narrative_id: "n1",
    order_index: overrides.order_index ?? 0,
    name: overrides.name ?? `Phase ${overrides.id}`,
    objective: null,
    rationale: null,
    status: "in_progress",
    progress_percent: overrides.progress_percent ?? null,
    start_date: null,
    end_date: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    workstreams: overrides.workstreams,
  } as unknown as NarrativePhaseWithWorkstreams;
}

function makeNarrative(
  over: Partial<{
    phases: NarrativePhaseWithWorkstreams[];
    orphan_workstreams: NarrativeWorkstream[];
    dependencies: NarrativeDependency[];
  }> = {},
): NarrativeWithChildren {
  return {
    id: "n1",
    phases: over.phases ?? [],
    orphan_workstreams: over.orphan_workstreams ?? [],
    dependencies: over.dependencies ?? [],
    risks: [],
  } as unknown as NarrativeWithChildren;
}

function makeIssue(
  key: string,
  status: StatusCategory = "To Do",
  dueDate: string | null = null,
): IssuePublicData {
  return {
    key,
    summary: `Summary for ${key}`,
    status_name: status,
    status_category: status,
    due_date: dueDate,
    assignee_display_name: null,
    issue_type: "Story",
  };
}

// --- Global progress + workstream-level aggregation ------------------

describe("computeDerived — global progress + per-workstream", () => {
  it("empty narrative (zero workstreams) → globalProgress=0, totalWorkstreams=0", () => {
    const result = computeDerived(makeNarrative(), new Map(), new Map());
    expect(result.totalWorkstreams).toBe(0);
    expect(result.globalProgress).toBe(0);
    expect(result.totalIssues).toBe(0);
  });

  it("single workstream, all issues Done at leaves → progress=100", () => {
    const ws = makeWS({ id: "ws1", jira_issue_keys: ["A", "B"] });
    const narrative = makeNarrative({ orphan_workstreams: [ws] });
    const issuesByKey = new Map([
      ["A", makeIssue("A", "Done")],
      ["B", makeIssue("B", "Done")],
    ]);
    const result = computeDerived(narrative, issuesByKey, new Map());
    expect(result.perWorkstream.get("ws1")?.progress).toBe(100);
    expect(result.globalProgress).toBe(100);
  });

  it("single workstream, half done → progress=50", () => {
    const ws = makeWS({ id: "ws1", jira_issue_keys: ["A", "B"] });
    const narrative = makeNarrative({ orphan_workstreams: [ws] });
    const issuesByKey = new Map([
      ["A", makeIssue("A", "Done")],
      ["B", makeIssue("B", "To Do")],
    ]);
    const result = computeDerived(narrative, issuesByKey, new Map());
    expect(result.perWorkstream.get("ws1")?.progress).toBe(50);
  });

  it("CANONICAL: each workstream weighted equally regardless of phase membership (phase [100,50,0] + orphan [50] → 50%)", () => {
    const ws100 = makeWS({ id: "ws-100", jira_issue_keys: ["A"] });
    const ws50 = makeWS({ id: "ws-50", jira_issue_keys: ["B", "C"] });
    const ws0 = makeWS({ id: "ws-0", jira_issue_keys: ["D"] });
    const wsOrphan = makeWS({ id: "ws-orphan", jira_issue_keys: ["E", "F"] });
    const phase = makePhase({
      id: "p1",
      workstreams: [ws100, ws50, ws0],
    });
    const narrative = makeNarrative({
      phases: [phase],
      orphan_workstreams: [wsOrphan],
    });
    const issuesByKey = new Map([
      ["A", makeIssue("A", "Done")], // ws-100 → 100
      ["B", makeIssue("B", "Done")], // ws-50 → 50
      ["C", makeIssue("C", "To Do")],
      ["D", makeIssue("D", "To Do")], // ws-0 → 0
      ["E", makeIssue("E", "Done")], // ws-orphan → 50
      ["F", makeIssue("F", "To Do")],
    ]);
    const result = computeDerived(narrative, issuesByKey, new Map());
    expect(result.totalWorkstreams).toBe(4);
    // (100 + 50 + 0 + 50) / 4 = 50. Phase ≠ unit of weighting.
    expect(result.globalProgress).toBe(50);
  });

  it("missing-from-sync issue keys do NOT participate in progress denominator", () => {
    const ws = makeWS({
      id: "ws1",
      jira_issue_keys: ["A", "MISSING-1", "B"],
    });
    const narrative = makeNarrative({ orphan_workstreams: [ws] });
    const issuesByKey = new Map([
      ["A", makeIssue("A", "Done")],
      ["B", makeIssue("B", "Done")],
      // MISSING-1 absent on purpose.
    ]);
    const result = computeDerived(narrative, issuesByKey, new Map());
    const wsd = result.perWorkstream.get("ws1");
    expect(wsd?.progress).toBe(100); // (100 + 100) / 2; missing excluded
    expect(wsd?.missingKeys).toEqual(["MISSING-1"]);
    expect(wsd?.foundIssues).toBe(2);
    expect(wsd?.totalKeys).toBe(3);
  });

  it("totalIssues counts unique found keys across workstreams (no double-count when shared)", () => {
    const ws1 = makeWS({ id: "ws1", jira_issue_keys: ["A", "B"] });
    const ws2 = makeWS({ id: "ws2", jira_issue_keys: ["B", "C"] });
    const narrative = makeNarrative({ orphan_workstreams: [ws1, ws2] });
    const issuesByKey = new Map([
      ["A", makeIssue("A")],
      ["B", makeIssue("B")],
      ["C", makeIssue("C")],
    ]);
    const result = computeDerived(narrative, issuesByKey, new Map());
    // A, B, C — B not double-counted across ws1 and ws2.
    expect(result.totalIssues).toBe(3);
  });
});

// --- Recursive progress ---------------------------------------------

describe("computeDerived — recursive progress closure", () => {
  it("non-leaf issue averages its loaded children (epic with Done + To Do stories → 50)", () => {
    const ws = makeWS({ id: "ws1", jira_issue_keys: ["E"] });
    const narrative = makeNarrative({ orphan_workstreams: [ws] });
    const issuesByKey = new Map([
      ["E", makeIssue("E", "In Progress")],
      ["S1", makeIssue("S1", "Done")],
      ["S2", makeIssue("S2", "To Do")],
    ]);
    const childrenMap = new Map<
      string,
      Array<{ key: string; status_category: StatusCategory }>
    >([
      [
        "E",
        [
          { key: "S1", status_category: "Done" },
          { key: "S2", status_category: "To Do" },
        ],
      ],
    ]);
    const result = computeDerived(narrative, issuesByKey, childrenMap);
    // E recursive = avg([100 (S1), 0 (S2)]) = 50. The Epic's own
    // status (In Progress) is ignored when it has loaded children.
    expect(result.perWorkstream.get("ws1")?.progress).toBe(50);
  });

  it("cycle protection: A → B → A logs warn + leaf-treats both, no infinite loop", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ws = makeWS({ id: "ws1", jira_issue_keys: ["A"] });
    const narrative = makeNarrative({ orphan_workstreams: [ws] });
    const issuesByKey = new Map([
      ["A", makeIssue("A", "Done")],
      ["B", makeIssue("B", "To Do")],
    ]);
    const childrenMap = new Map<
      string,
      Array<{ key: string; status_category: StatusCategory }>
    >([
      ["A", [{ key: "B", status_category: "To Do" }]],
      ["B", [{ key: "A", status_category: "Done" }]],
    ]);

    expect(() =>
      computeDerived(narrative, issuesByKey, childrenMap),
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0]?.[0]).toMatch(/cycle detected/);

    warnSpy.mockRestore();
  });
});

// --- Per-phase progress ---------------------------------------------

describe("computeDerived — per-phase progress", () => {
  it("respects manual progress_percent override (hasManualProgress=true)", () => {
    const ws = makeWS({ id: "ws1", jira_issue_keys: ["A"] });
    // Workstream is 0% (To Do), but the phase manually overrides to 75.
    const phase = makePhase({
      id: "p1",
      workstreams: [ws],
      progress_percent: 75,
    });
    const narrative = makeNarrative({ phases: [phase] });
    const issuesByKey = new Map([["A", makeIssue("A", "To Do")]]);
    const result = computeDerived(narrative, issuesByKey, new Map());
    const phaseDerived = result.perPhase.get("p1");
    expect(phaseDerived?.progress).toBe(75);
    expect(phaseDerived?.hasManualProgress).toBe(true);
  });

  it("no override → simple average of workstreams (hasManualProgress=false)", () => {
    const ws1 = makeWS({ id: "ws1", jira_issue_keys: ["A"] });
    const ws2 = makeWS({ id: "ws2", jira_issue_keys: ["B"] });
    const phase = makePhase({ id: "p1", workstreams: [ws1, ws2] });
    const narrative = makeNarrative({ phases: [phase] });
    const issuesByKey = new Map([
      ["A", makeIssue("A", "Done")],
      ["B", makeIssue("B", "To Do")],
    ]);
    const result = computeDerived(narrative, issuesByKey, new Map());
    const phaseDerived = result.perPhase.get("p1");
    expect(phaseDerived?.progress).toBe(50);
    expect(phaseDerived?.hasManualProgress).toBe(false);
  });

  it("phase with zero workstreams reports 0% (no manual override)", () => {
    const phase = makePhase({ id: "p1", workstreams: [] });
    const narrative = makeNarrative({ phases: [phase] });
    const result = computeDerived(narrative, new Map(), new Map());
    expect(result.perPhase.get("p1")?.progress).toBe(0);
  });

  it("manual progress is clamped to [0, 100]", () => {
    const phase1 = makePhase({
      id: "p1",
      workstreams: [],
      progress_percent: 150,
    });
    const phase2 = makePhase({
      id: "p2",
      workstreams: [],
      progress_percent: -25,
    });
    const narrative = makeNarrative({ phases: [phase1, phase2] });
    const result = computeDerived(narrative, new Map(), new Map());
    expect(result.perPhase.get("p1")?.progress).toBe(100);
    expect(result.perPhase.get("p2")?.progress).toBe(0);
  });
});

// --- Overdue counting -----------------------------------------------

describe("computeDerived — overdue counting", () => {
  it("counts past-due + not-Done as overdue; past-due + Done is NOT overdue", () => {
    // 2020-01-01 is well in the past for any reasonable runtime year.
    const past = "2020-01-01";

    const ws = makeWS({ id: "ws1", jira_issue_keys: ["A", "B", "C", "D"] });
    const narrative = makeNarrative({ orphan_workstreams: [ws] });
    const issuesByKey = new Map([
      ["A", makeIssue("A", "To Do", past)], // overdue
      ["B", makeIssue("B", "In Progress", past)], // overdue
      ["C", makeIssue("C", "Done", past)], // NOT overdue (Done shields)
      ["D", makeIssue("D", "To Do", null)], // NOT overdue (no due date)
    ]);
    const result = computeDerived(narrative, issuesByKey, new Map());
    expect(result.perWorkstream.get("ws1")?.overdueCount).toBe(2);
  });
});

// --- deriveRiskLevel precedence -------------------------------------

describe("deriveRiskLevel — precedence rules", () => {
  it("blocked → critical regardless of dates", () => {
    expect(
      deriveRiskLevel({ delayRiskDays: -100, commitmentStatus: "blocked" }),
    ).toBe("critical");
    expect(
      deriveRiskLevel({ delayRiskDays: null, commitmentStatus: "blocked" }),
    ).toBe("critical");
    expect(
      deriveRiskLevel({ delayRiskDays: 50, commitmentStatus: "blocked" }),
    ).toBe("critical");
  });

  it("delay > 14 + fragile commitment (at_risk | proposed) → critical", () => {
    expect(
      deriveRiskLevel({ delayRiskDays: 15, commitmentStatus: "at_risk" }),
    ).toBe("critical");
    expect(
      deriveRiskLevel({ delayRiskDays: 30, commitmentStatus: "proposed" }),
    ).toBe("critical");
  });

  it("delay > 14 with confirmed/agreed commitment is high (rule 2's `fragile` gate matters)", () => {
    expect(
      deriveRiskLevel({ delayRiskDays: 30, commitmentStatus: "confirmed" }),
    ).toBe("high");
    expect(
      deriveRiskLevel({ delayRiskDays: 30, commitmentStatus: "agreed" }),
    ).toBe("high");
  });

  it("delay > 7 OR status=at_risk → high", () => {
    expect(
      deriveRiskLevel({ delayRiskDays: 10, commitmentStatus: "agreed" }),
    ).toBe("high");
    expect(
      deriveRiskLevel({ delayRiskDays: 0, commitmentStatus: "at_risk" }),
    ).toBe("high");
  });

  it("0 < delay ≤ 7 OR status=proposed → medium", () => {
    expect(
      deriveRiskLevel({ delayRiskDays: 3, commitmentStatus: "agreed" }),
    ).toBe("medium");
    // delay=0 doesn't satisfy the date clause (0 not > 0); proposed
    // alone drops the row to medium per the OR.
    expect(
      deriveRiskLevel({ delayRiskDays: 0, commitmentStatus: "proposed" }),
    ).toBe("medium");
    expect(
      deriveRiskLevel({ delayRiskDays: 7, commitmentStatus: "agreed" }),
    ).toBe("medium");
  });

  it("on time / early + agreed/confirmed → low", () => {
    expect(
      deriveRiskLevel({ delayRiskDays: 0, commitmentStatus: "agreed" }),
    ).toBe("low");
    expect(
      deriveRiskLevel({ delayRiskDays: -5, commitmentStatus: "confirmed" }),
    ).toBe("low");
  });

  it("null delay falls through to status alone (no fabricated risk from missing dates)", () => {
    expect(
      deriveRiskLevel({ delayRiskDays: null, commitmentStatus: "confirmed" }),
    ).toBe("low");
    expect(
      deriveRiskLevel({ delayRiskDays: null, commitmentStatus: "agreed" }),
    ).toBe("low");
    expect(
      deriveRiskLevel({ delayRiskDays: null, commitmentStatus: "at_risk" }),
    ).toBe("high");
    expect(
      deriveRiskLevel({ delayRiskDays: null, commitmentStatus: "proposed" }),
    ).toBe("medium");
  });
});
