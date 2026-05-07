import "server-only";
import { AI_MODEL, getAnthropicClient } from "@/lib/ai/client";
import {
  buildGeneratePrompt,
  buildRefinePrompt,
  SYSTEM_PROMPT,
  type IssueForPrompt,
} from "@/lib/ai/prompts/workstream-description";
import { logAIUsage, type AIOperation } from "@/lib/ai/usage/log";
import { computeCostUsd } from "@/lib/ai/usage/pricing";
import { getServerSupabaseAdmin } from "@/lib/supabase/service";

// Despite the `actions/` directory name (chosen for parity with iter 7
// spec), these are plain async helpers — NOT `'use server'` Server
// Actions. The route handler at /api/ai/workstream-description
// (iter 7 commit 4) imports `runWorkstreamDescription` directly to
// add streaming on top. A future iter could wrap it in a Server Action
// if a non-streaming form-driven UI surface emerges.
//
// Trust boundary: the caller (route handler) verifies user auth via
// getServerSupabase() before invoking. We accept user info as a
// parameter and trust it. Issues are fetched via the admin client
// because they're already fully readable to `authenticated` per the
// existing RLS — the bypass yields no extra disclosure surface.

export interface WorkstreamAIInput {
  userId: string;
  userEmail: string;
  workstreamId: string;
  narrativeId: string;
  issueKeys: string[];
  // currentText present and non-empty => refine; absent / empty => generate.
  currentText?: string | null;
  locale: "en" | "es";
  signal?: AbortSignal;
}

export interface WorkstreamAIResult {
  output: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  operation: AIOperation;
}

async function fetchIssuesForPrompt(
  issueKeys: string[],
): Promise<IssueForPrompt[]> {
  if (issueKeys.length === 0) return [];
  const supabase = getServerSupabaseAdmin();
  const { data, error } = await supabase
    .from("issues")
    .select("key, summary, issue_type, status_category")
    .in("key", issueKeys);
  if (error) throw error;
  if (!data) return [];
  return data.map((it) => ({
    key: it.key,
    summary: it.summary,
    issue_type: it.issue_type,
    status_category: it.status_category,
  }));
}

// Build the JSONB shape that ai_usage.input expects per the migration
// column comment. Centralized here so log calls in the success and
// error paths can't drift.
function buildLogInput(
  input: WorkstreamAIInput,
  issues: IssueForPrompt[],
): Record<string, unknown> {
  return {
    issueKeys: input.issueKeys,
    summaries: issues.map((i) => i.summary),
    currentText: input.currentText ?? undefined,
    locale: input.locale,
  };
}

export async function runWorkstreamDescription(
  input: WorkstreamAIInput,
): Promise<WorkstreamAIResult> {
  const startedAt = Date.now();
  const operation: AIOperation =
    input.currentText && input.currentText.trim().length > 0
      ? "refine_workstream_description"
      : "generate_workstream_description";

  const issues = await fetchIssuesForPrompt(input.issueKeys);
  if (issues.length === 0) {
    const err = new Error(
      `No issues found for keys: ${input.issueKeys.join(", ")}`,
    );
    await logAIUsage({
      userId: input.userId,
      userEmail: input.userEmail,
      operation,
      workstreamId: input.workstreamId,
      narrativeId: input.narrativeId,
      input: buildLogInput(input, []),
      status: "error",
      errorMessage: err.message,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }

  const userPrompt =
    operation === "refine_workstream_description"
      ? buildRefinePrompt(issues, input.currentText as string)
      : buildGeneratePrompt(issues);

  const client = getAnthropicClient();

  try {
    const response = await client.messages.create(
      {
        model: AI_MODEL,
        // 300 tokens ~= 225 words at the model's typical density;
        // comfortably above the 50-100 word target with slack for
        // verbose models. Cap is a runaway-cost guard, not a hard
        // budget — outputs almost always come in under 100 tokens.
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      },
      { signal: input.signal },
    );

    // Concatenate every text block; in practice Anthropic returns one,
    // but the SDK types it as an array (room for tool_use blocks etc).
    let outputText = "";
    for (const block of response.content) {
      if (block.type === "text") outputText += block.text;
    }
    const output = outputText.trim();

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd = computeCostUsd({ inputTokens, outputTokens });
    const durationMs = Date.now() - startedAt;

    await logAIUsage({
      userId: input.userId,
      userEmail: input.userEmail,
      operation,
      workstreamId: input.workstreamId,
      narrativeId: input.narrativeId,
      input: buildLogInput(input, issues),
      output,
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
      status: "success",
    });

    return {
      output,
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
      operation,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // SDK throws APIUserAbortError on signal abort; Node throws
    // AbortError directly. Match either by name.
    const isAbort =
      e instanceof Error &&
      (e.name === "AbortError" || e.name.includes("Abort"));
    await logAIUsage({
      userId: input.userId,
      userEmail: input.userEmail,
      operation,
      workstreamId: input.workstreamId,
      narrativeId: input.narrativeId,
      input: buildLogInput(input, issues),
      status: isAbort ? "cancelled" : "error",
      errorMessage: message,
      durationMs: Date.now() - startedAt,
    });
    throw e;
  }
}
