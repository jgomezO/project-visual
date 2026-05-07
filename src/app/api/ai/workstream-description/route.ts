import { NextResponse, type NextRequest } from "next/server";
import { AI_MODEL, getAnthropicClient } from "@/lib/ai/client";
import {
  buildGeneratePrompt,
  buildRefinePrompt,
  SYSTEM_PROMPT,
  type IssueForPrompt,
} from "@/lib/ai/prompts/workstream-description";
import { logAIUsage, type AIOperation } from "@/lib/ai/usage/log";
import { computeCostUsd } from "@/lib/ai/usage/pricing";
import { getServerSupabase } from "@/lib/supabase/server";
import { getServerSupabaseAdmin } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hobby plan ceiling. Anthropic streaming for ~5 issues / ~100-word
// output typically completes in 1-3s — the bump from default 10s gives
// plenty of slack for occasional 5-10s tail latencies on Anthropic's
// side without the platform terminating us.
export const maxDuration = 60;

interface RequestBody {
  workstreamId: string;
  narrativeId: string;
  issueKeys: string[];
  currentText?: string;
  locale: "en" | "es";
}

// Single SSE frame: `data: <json>\n\n` per the EventStream spec.
// Plain JSON payload (not a multi-event format) — clients parse one
// frame at a time and dispatch on the `type` field.
function sseFrame(payload: object): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function buildLogInput(
  body: RequestBody,
  issues: IssueForPrompt[],
): Record<string, unknown> {
  return {
    issueKeys: body.issueKeys,
    summaries: issues.map((i) => i.summary),
    currentText: body.currentText ?? undefined,
    locale: body.locale,
  };
}

// POST handler — streaming AI workstream-description (iter 7 commit 4).
//
// Wire format: text/event-stream over HTTP POST. Client uses fetch +
// ReadableStream + manual parsing (NOT EventSource — EventSource is
// GET-only and we need POST for the body shape). See iter 7 plan Q1.
//
// Three event types the client receives:
//   { "type": "chunk", "delta": "<piece of text>" }   — repeated
//   { "type": "done",  "usage": { inputTokens, outputTokens, costUsd } } — terminal success
//   { "type": "error", "message": "..." }              — terminal error
//
// Cancellation: when request.signal aborts (client navigated /
// modal closed / explicit abort), the Anthropic SDK propagates
// AbortError and we log a row with status='cancelled'. Anthropic
// still bills partial input + output before the abort propagates,
// so cost_usd on cancelled rows is typically non-zero.
export async function POST(request: NextRequest): Promise<Response> {
  const startedAt = Date.now();

  // 1. Auth via the user-scoped client. middleware already guarded
  // /<locale>/* paths, but /api/ai/* lives outside the locale prefix
  // and isn't auto-gated — verify here.
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;
  const userEmail = user.email;

  // 2. Parse + validate body.
  let body: RequestBody;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }
    body = parsed as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body.workstreamId !== "string" ||
    typeof body.narrativeId !== "string" ||
    !Array.isArray(body.issueKeys) ||
    body.issueKeys.length === 0 ||
    !body.issueKeys.every((k) => typeof k === "string") ||
    (body.locale !== "en" && body.locale !== "es") ||
    (body.currentText !== undefined && typeof body.currentText !== "string")
  ) {
    return NextResponse.json(
      { error: "Invalid request shape" },
      { status: 400 },
    );
  }

  const operation: AIOperation =
    body.currentText && body.currentText.trim().length > 0
      ? "refine_workstream_description"
      : "generate_workstream_description";

  // 3. Fetch issues for the prompt. Admin client bypasses RLS — safe
  // because we already verified `user` and the issues table is fully
  // readable to `authenticated` per existing RLS.
  const adminSupabase = getServerSupabaseAdmin();
  const { data: issuesData, error: fetchError } = await adminSupabase
    .from("issues")
    .select("key, summary, issue_type, status_category")
    .in("key", body.issueKeys);

  if (fetchError) {
    await logAIUsage({
      userId,
      userEmail,
      operation,
      workstreamId: body.workstreamId,
      narrativeId: body.narrativeId,
      input: buildLogInput(body, []),
      status: "error",
      errorMessage: fetchError.message,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "Could not fetch issues" },
      { status: 500 },
    );
  }

  const issues: IssueForPrompt[] = (issuesData ?? []).map((it) => ({
    key: it.key,
    summary: it.summary,
    issue_type: it.issue_type,
    status_category: it.status_category,
  }));

  if (issues.length === 0) {
    await logAIUsage({
      userId,
      userEmail,
      operation,
      workstreamId: body.workstreamId,
      narrativeId: body.narrativeId,
      input: buildLogInput(body, []),
      status: "error",
      errorMessage: "No issues found for keys",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { error: "No issues found for keys" },
      { status: 404 },
    );
  }

  // 4. Open Anthropic stream + return SSE response.
  const userPrompt =
    operation === "refine_workstream_description"
      ? buildRefinePrompt(issues, body.currentText as string)
      : buildGeneratePrompt(issues);

  const client = getAnthropicClient();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let outputText = "";
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;

      const safeEnqueue = (frame: string): void => {
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          // Stream closed by client (abort) — Anthropic stream will
          // also error out on the next iteration; nothing to do here.
        }
      };

      const safeClose = (): void => {
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      try {
        const aiStream = client.messages.stream(
          {
            model: AI_MODEL,
            max_tokens: 300,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: userPrompt }],
          },
          { signal: request.signal },
        );

        for await (const event of aiStream) {
          if (event.type === "message_start") {
            inputTokens = event.message.usage?.input_tokens ?? inputTokens;
          } else if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const delta = event.delta.text;
            outputText += delta;
            safeEnqueue(sseFrame({ type: "chunk", delta }));
          } else if (event.type === "message_delta") {
            outputTokens = event.usage?.output_tokens ?? outputTokens;
          }
        }

        const costUsd =
          inputTokens != null && outputTokens != null
            ? computeCostUsd({ inputTokens, outputTokens })
            : null;

        await logAIUsage({
          userId,
          userEmail,
          operation,
          workstreamId: body.workstreamId,
          narrativeId: body.narrativeId,
          input: buildLogInput(body, issues),
          output: outputText.trim(),
          inputTokens,
          outputTokens,
          costUsd,
          durationMs: Date.now() - startedAt,
          status: "success",
        });

        safeEnqueue(
          sseFrame({
            type: "done",
            usage: { inputTokens, outputTokens, costUsd },
          }),
        );
        safeClose();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // SDK throws APIUserAbortError on signal abort; Node's fetch
        // throws AbortError. Match either by name pattern.
        const isAbort =
          e instanceof Error &&
          (e.name === "AbortError" || e.name.includes("Abort"));

        const partialOutput =
          outputText.trim().length > 0 ? outputText.trim() : null;
        const costUsd =
          inputTokens != null && outputTokens != null
            ? computeCostUsd({ inputTokens, outputTokens })
            : null;

        await logAIUsage({
          userId,
          userEmail,
          operation,
          workstreamId: body.workstreamId,
          narrativeId: body.narrativeId,
          input: buildLogInput(body, issues),
          output: partialOutput,
          inputTokens,
          outputTokens,
          costUsd,
          durationMs: Date.now() - startedAt,
          status: isAbort ? "cancelled" : "error",
          errorMessage: message,
        });

        // On error (not abort): best-effort error frame so the client
        // can show an inline message before the connection closes.
        if (!isAbort) {
          safeEnqueue(sseFrame({ type: "error", message }));
        }
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      // Disable proxy buffering (Vercel / nginx). Without this the
      // first chunks may sit in the proxy until enough bytes accumulate.
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
