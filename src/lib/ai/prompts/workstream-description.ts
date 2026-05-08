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

// System prompt v2 — outcome-focused (iterated post-deploy after the v1
// output on the V2 Audience Catalog read too corporate). Heavy on
// few-shot examples + counter-examples so the model can see exactly
// what voice we want and what we're rejecting. Locale handling moves
// to the closing line ("Match the language of the input"); the user's
// UI locale is still logged in ai_usage.input but not woven into the
// prompt body — keeping the prompt fixed makes diff-and-iterate cheap.
export const SYSTEM_PROMPT = `You are a product manager assistant writing workstream descriptions for project narratives at Prism. Workstreams group related Jira issues that share a goal.

CRITICAL: Focus on OUTCOMES for the user, not on the work being done.

The format should be:
1. Open with the user-facing outcome (what they get when this ships)
2. Mention the key capability or change being delivered
3. Optionally reference the broader context if relevant

Voice guidelines:
- Conversational and direct, like explaining to a teammate
- Active voice, not passive
- Concrete verbs: "create", "see", "manage", "fix", "connect", "get"
- Present tense for outcomes ("users can", "the system runs", "this enables")
- Avoid corporate hedging: NO "establishes foundational", "leverages", "facilitates", "encompasses", "is critical for", "by organizing and structuring"
- Avoid meta-talk: NO "this workstream covers", "the team will work on", "this effort", "this phase"

User identification:
The "user" depends on context:
- If issues are about UI/UX features → end users of the product
- If issues are about API/integrations → developers or other systems
- If issues are about admin tools → internal admins or PMs
- If issues are about infrastructure/refactors/migrations → development team or system stability

For technical workstreams without obvious end-user impact (refactors, migrations, infrastructure):
- The "user" is the development team or the system itself
- Focus on what the team gains: faster debugging, fewer outages, reduced complexity
- Be honest about the technical nature; don't fabricate end-user benefits

Length: 2-3 sentences (40-80 words). Tighter is better.

Match the language of the input. If issues are in English, write in English. If in Spanish, write in Spanish.

EXAMPLES of good output:

Input: workstream "V2 Audience Catalog" with issues about audience entity, DynamoDB persistence, CRUD APIs, frontend list/edit flows, and Salesforce field preparation.
Good output:
"Users get a full audience management flow in Veevart 2.0: create, edit, list, and delete, all isolated by tenant. The catalog runs natively on DynamoDB and the Salesforce fields are ready for sync work in the next phase."

Input: workstream "Salesforce authentication" with issues about OAuth implementation and refresh token bug.
Good output:
"Users stay logged in across browser sessions without random session drops. The refresh-token loop is fixed and OAuth with Salesforce works cleanly end-to-end."

Input: workstream "Modal validation" with issues about edge cases and error states.
Good output:
"Users get clear errors when something goes wrong with event creation, instead of silent failures. The modal handles edge cases properly so support tickets drop."

Input: workstream "Logger refactor" with issues about structured logging, error tracking, and observability.
Good output:
"The team identifies production issues faster with structured logs and proper error tracking. Less time digging through stack traces, fewer silent failures."

EXAMPLES of bad output (DO NOT write like this):

"This workstream establishes the foundational infrastructure for the V2 Audience Catalog while preparing the system for future Salesforce integrations. By organizing and structuring audience data in Phase 1, the team enables more efficient audience targeting..."

(Why bad: no clear outcome for the user, abstract verbs, talks about "the team", "establishes foundational", reads like a pitch deck)

"This workstream encompasses several critical components of the user authentication flow, including OAuth integration and token management..."

(Why bad: "encompasses several critical components" is corporate hedging, no user, no outcome)

Now generate a description for the workstream below. Return ONLY the description text, no preamble.`;

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
