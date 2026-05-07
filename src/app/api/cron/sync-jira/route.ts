import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runSync } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hobby plan caps serverless function duration at 60s. Sync today
// finishes in ~25-40s for ~5 projects; the bump from the default 10s
// gives headroom + a 20s+ buffer before the platform terminates us.
// If we ever blow past 60s we'll need to parallelize Jira fetches or
// move sync into a background queue (out of iter 6 scope).
export const maxDuration = 60;

function safeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf-8");
  const bBuf = Buffer.from(b, "utf-8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// Vercel Cron entry point. The schedule is declared in vercel.json
// (one daily run at 06:00 UTC). Vercel attaches `Authorization: Bearer
// ${CRON_SECRET}` to every cron-driven invocation; we verify against
// our env var with a constant-time comparison.
//
// GET only because Vercel Cron does not support other verbs.
//
// We import runSync() directly instead of self-fetching /api/sync so:
//   - one serverless function counts against budgets, not two
//   - the 60s budget is one budget, not two stacked
//   - no network round-trip / DNS / TLS for a same-process call
//   - we don't need SYNC_SECRET in this code path
//
// triggered_by='cron' lands on every sync_run row this path opens —
// the dashboard can later split scheduled-health from PM-clicks if
// product asks.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    console.error("[cron] CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Server misconfigured: CRON_SECRET is not set." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expectedHeader = `Bearer ${expected}`;
  if (!safeStringEqual(authHeader, expectedHeader)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  console.log(`[cron] sync-jira starting at ${new Date().toISOString()}`);

  // runSync owns its own try/catch, sync_run row lifecycle, and per-
  // project resilience. We only need to map its terminal status to
  // an HTTP status code for the cron caller (Vercel logs).
  const result = await runSync({ triggeredBy: "cron" });

  const durationMs = Date.now() - startedAt;
  console.log(
    `[cron] sync-jira completed status=${result.status} success=${result.success} ` +
      `failed=${result.failed.length} durationMs=${durationMs} ` +
      `runId=${result.syncRunId}`,
  );

  // Same mapping as /api/sync: 200 on success or partial (some progress
  // made), 500 only when nothing succeeded OR the run aborted pre-loop.
  return NextResponse.json(result, {
    status: result.status === "failed" ? 500 : 200,
  });
}
