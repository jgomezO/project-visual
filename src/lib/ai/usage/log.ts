import "server-only";
import { getServerSupabaseAdmin } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";

export type AIOperation =
  | "generate_workstream_description"
  | "refine_workstream_description";

export type AIStatus = "success" | "error" | "cancelled";

export interface LogAIUsageInput {
  userId: string;
  userEmail: string;
  operation: AIOperation;
  workstreamId?: string | null;
  narrativeId?: string | null;
  // Per-operation shape lives in the migration's column comment.
  // Caller serializes once; we trust the shape.
  input: Record<string, unknown>;
  output?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  costUsd?: number | null;
  durationMs?: number | null;
  status: AIStatus;
  errorMessage?: string | null;
}

// Insert one ai_usage row using the service-role client. The audit log
// is immutable from the application's perspective: there's no public
// UPDATE / DELETE policy, and we never expose this helper to client
// code — the route handler / Server Action calls it once at terminal
// state (success / error / cancelled).
//
// On a logging failure (Supabase down, schema drift, etc.) we surface
// the secondary error via console.error but do NOT throw — the AI
// operation itself may have succeeded, and forcing the caller to fail
// because of a downstream log issue is worse than losing one audit row.
// This matches sync/runs.ts failRun() pattern.
export async function logAIUsage(input: LogAIUsageInput): Promise<void> {
  const supabase = getServerSupabaseAdmin();
  const { error } = await supabase.from("ai_usage").insert({
    user_id: input.userId,
    user_email: input.userEmail,
    operation: input.operation,
    workstream_id: input.workstreamId ?? null,
    narrative_id: input.narrativeId ?? null,
    input: input.input as unknown as Json,
    output: input.output ?? null,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    cost_usd: input.costUsd ?? null,
    duration_ms: input.durationMs ?? null,
    status: input.status,
    error_message: input.errorMessage ?? null,
  });
  if (error) {
    console.error(
      `[ai] failed to log ai_usage row: ${error.message} ` +
        `(operation=${input.operation} status=${input.status})`,
    );
  }
}
