import "server-only";

// Pure prompt builders for the workstream-description AI assist (iter 7).
// Side-effect-free + deterministic given inputs — every other module
// (route handler, Server Action wrapper, test scripts) consumes these
// as plain functions.

// Truncation guardrail. Jira summaries can run 200+ chars on outliers;
// 10 issues × 300 chars = 3000+ tokens of prompt junk just for context.
// 200 chars per summary keeps the prompt cost predictable while
// preserving enough signal for the model to synthesize. Trade-off
// documented in CLAUDE.md > AI assist.
const SUMMARY_MAX_CHARS = 200;

export interface IssueForPrompt {
  // Jira issue key (e.g. "NOXSCRUM-123"). Pinned to the actual column
  // name in our `issues` table — NOT renamed `jira_key` per spec draft.
  key: string;
  summary: string;
  issue_type: string;
  // Constrained to "To Do" | "In Progress" | "Done" by the issues
  // table CHECK; typed as plain `string` here to avoid a redundant
  // cast at every call site (the prompt builder only interpolates).
  status_category: string;
}

export function truncateSummary(s: string, max = SUMMARY_MAX_CHARS): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

// System prompt is locale-agnostic by design: the spec instructs the
// model to "Match the language of the workstream context", so the
// model auto-detects from issue summaries. The user's UI locale is
// logged separately in ai_usage.input but not woven into the prompt
// — keeping the prompt fixed makes diff-and-iterate cheaper. If
// quality is off later, this is the obvious lever.
export const SYSTEM_PROMPT = `You are a product manager assistant helping write workstream descriptions for project narratives. Workstreams are groups of related work items (Jira issues) that share a goal within a larger project.

Guidelines:
- Tone: professional but accessible, no unnecessary jargon
- Length: 50-100 words (2-3 sentences)
- Perspective: third-person objective (e.g., "This workstream covers..." NOT "We will...")
- Focus on what the workstream accomplishes technically AND why it matters
- Don't list issues individually; synthesize their collective purpose
- Match the language of the workstream context (if issues are in English, write in English)

You will receive Jira issues that compose the workstream. Synthesize their collective purpose into a concise description.`;

function formatIssuesBlock(issues: IssueForPrompt[]): string {
  return issues
    .map((it, i) => {
      const summary = truncateSummary(it.summary);
      return `[Issue ${i + 1}] ${it.key} (${it.issue_type}, ${it.status_category})\nSummary: ${summary}`;
    })
    .join("\n\n");
}

export function buildGeneratePrompt(issues: IssueForPrompt[]): string {
  return `Generate a workstream description based on these Jira issues:

${formatIssuesBlock(issues)}

Write a 2-3 sentence description that captures what this workstream accomplishes and why it matters. Match the language of the issue content.`;
}

export function buildRefinePrompt(
  issues: IssueForPrompt[],
  currentText: string,
): string {
  return `Here is the current workstream description:

"${currentText}"

Here are the Jira issues that compose this workstream:

${formatIssuesBlock(issues)}

Refine the current description by:
- Improving clarity and specificity
- Ensuring it accurately reflects what the issues accomplish
- Maintaining the original sentiment and intent
- Keeping length to 50-100 words

Return only the refined description, no preamble or explanation.`;
}
