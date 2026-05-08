import { describe, expect, it } from "vitest";
import {
  buildGeneratePrompt,
  buildRefinePrompt,
  SYSTEM_PROMPT,
  truncateSummary,
  type IssueForPrompt,
} from "./workstream-description";

// Three test surfaces:
//
// 1. truncateSummary: assertion-based unit logic. Tight boundary cases.
// 2. buildGeneratePrompt / buildRefinePrompt: inline snapshots that
//    detect *structural* drift (formatting, escaping, newline rules).
//    They do NOT validate prompt quality — that's a model-evaluation
//    problem. When we intentionally change the prompt format the
//    snapshot fails, we run `pnpm test -u` and review the diff in
//    PR. Filing this drift behind structural snapshots also catches
//    accidental edits like "[Issue 1]" → "[ Issue 1]".
// 3. SYSTEM_PROMPT contains-checks: not a snapshot (would just
//    duplicate the const). Instead, a few `toContain` assertions guard
//    against a careless edit that drops a critical guidance phrase
//    ("OUTCOMES", the bad-output examples, the language directive).

const sampleIssues: IssueForPrompt[] = [
  {
    key: "NOX-100",
    summary: "Add audience entity with tenant isolation",
    issue_type: "Story",
    status_category: "In Progress",
  },
  {
    key: "NOX-101",
    summary: "Persist audience records on DynamoDB",
    issue_type: "Task",
    status_category: "Done",
  },
  {
    key: "NOX-102",
    summary: "Frontend list + edit flow for audiences",
    issue_type: "Story",
    status_category: "To Do",
  },
];

describe("truncateSummary", () => {
  it("returns short strings unchanged", () => {
    expect(truncateSummary("hello", 200)).toBe("hello");
  });

  it("returns a string of exactly N chars unchanged", () => {
    const exact = "x".repeat(200);
    expect(truncateSummary(exact, 200)).toBe(exact);
  });

  it("truncates strings longer than N to N-1 chars + ellipsis (200 chars total)", () => {
    const long = "x".repeat(201);
    const out = truncateSummary(long, 200);
    expect(out.length).toBe(200);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, 199)).toBe("x".repeat(199));
  });

  it("uses 200 as the default max", () => {
    const long = "y".repeat(250);
    const out = truncateSummary(long);
    expect(out.length).toBe(200);
    expect(out.endsWith("…")).toBe(true);
  });

  it("custom max value works for shorter caps", () => {
    expect(truncateSummary("hello world", 5)).toBe("hell…");
  });
});

describe("buildGeneratePrompt — structural snapshot", () => {
  it("formats 3 issues with the canonical [Issue N] block layout", () => {
    expect(buildGeneratePrompt(sampleIssues)).toMatchInlineSnapshot(`
      "Generate a workstream description based on these Jira issues:

      [Issue 1] NOX-100 (Story, In Progress)
      Summary: Add audience entity with tenant isolation

      [Issue 2] NOX-101 (Task, Done)
      Summary: Persist audience records on DynamoDB

      [Issue 3] NOX-102 (Story, To Do)
      Summary: Frontend list + edit flow for audiences

      Write a 2-3 sentence description that captures what this workstream accomplishes and why it matters. Match the language of the issue content."
    `);
  });

  it("truncates an oversized summary inline (>200 chars → ellipsis at boundary)", () => {
    const longSummary = "A".repeat(250);
    const oneLong: IssueForPrompt[] = [
      {
        key: "NOX-LONG",
        summary: longSummary,
        issue_type: "Story",
        status_category: "To Do",
      },
    ];
    const out = buildGeneratePrompt(oneLong);
    // The truncated form ends with the 199-char A run + ellipsis.
    expect(out).toContain(`Summary: ${"A".repeat(199)}…`);
    // Original 250 A's must NOT survive intact.
    expect(out).not.toContain("A".repeat(250));
  });

  it("empty issues array still renders prompt scaffold (no issue blocks)", () => {
    // Defensive: the route handler validates issueKeys.length > 0, so
    // this path is unreachable from the UI; documenting current
    // behavior so a future refactor doesn't silently change it.
    const out = buildGeneratePrompt([]);
    expect(out).toContain(
      "Generate a workstream description based on these Jira issues:",
    );
    expect(out).toContain(
      "Write a 2-3 sentence description that captures what this workstream",
    );
  });
});

describe("buildRefinePrompt — structural snapshot", () => {
  it("places currentText in quotes followed by issue block + refine instructions", () => {
    const currentText =
      "The team is building an audience catalog with full CRUD.";
    expect(buildRefinePrompt(sampleIssues, currentText))
      .toMatchInlineSnapshot(`
      "Here is the current workstream description:

      "The team is building an audience catalog with full CRUD."

      Here are the Jira issues that compose this workstream:

      [Issue 1] NOX-100 (Story, In Progress)
      Summary: Add audience entity with tenant isolation

      [Issue 2] NOX-101 (Task, Done)
      Summary: Persist audience records on DynamoDB

      [Issue 3] NOX-102 (Story, To Do)
      Summary: Frontend list + edit flow for audiences

      Refine the current description by:
      - Improving clarity and specificity
      - Ensuring it accurately reflects what the issues accomplish
      - Maintaining the original sentiment and intent
      - Keeping length to 50-100 words

      Return only the refined description, no preamble or explanation."
    `);
  });
});

describe("SYSTEM_PROMPT — critical-phrase guards", () => {
  // Not a snapshot: snapshotting a const just duplicates it. These
  // checks fire if a refactor accidentally drops a load-bearing
  // instruction from the prompt v2 contract.

  it("contains the OUTCOMES focus directive", () => {
    expect(SYSTEM_PROMPT).toContain("OUTCOMES");
    expect(SYSTEM_PROMPT).toContain("Focus on OUTCOMES for the user");
  });

  it("contains the corporate-hedging deny-list", () => {
    expect(SYSTEM_PROMPT).toContain("establishes foundational");
    expect(SYSTEM_PROMPT).toContain("by organizing and structuring");
    expect(SYSTEM_PROMPT).toContain("encompasses");
  });

  it("contains the meta-talk deny-list", () => {
    expect(SYSTEM_PROMPT).toContain("this workstream covers");
    expect(SYSTEM_PROMPT).toContain("the team will work on");
  });

  it("contains both good-output and bad-output example sections", () => {
    expect(SYSTEM_PROMPT).toContain("EXAMPLES of good output");
    expect(SYSTEM_PROMPT).toContain("EXAMPLES of bad output");
  });

  it("retains the language-matching directive", () => {
    expect(SYSTEM_PROMPT).toContain("Match the language of the input");
  });

  it("retains the technical-workstream user-identification rule", () => {
    expect(SYSTEM_PROMPT).toContain(
      "For technical workstreams without obvious end-user impact",
    );
    expect(SYSTEM_PROMPT).toContain(
      "don't fabricate end-user benefits",
    );
  });

  it("ends with the 'return only the description' closing instruction", () => {
    // The model must NOT preamble. If the closing line drops, outputs
    // start coming with "Sure! Here's the description:" preamble.
    expect(SYSTEM_PROMPT).toContain(
      "Return ONLY the description text, no preamble.",
    );
  });
});
