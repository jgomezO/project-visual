import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runSync, type RunSyncArgs } from "@/lib/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SyncRequestBody {
  type?: "full" | "incremental";
  projectKey?: string;
}

function safeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf-8");
  const bBuf = Buffer.from(b, "utf-8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard: SYNC_SECRET must be configured server-side.
  const expected = process.env.SYNC_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "Server misconfigured: SYNC_SECRET is not set." },
      { status: 500 },
    );
  }

  const provided = request.headers.get("x-sync-secret")?.trim() ?? "";
  if (!safeStringEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse optional body. An empty / missing body is fine — defaults apply.
  let body: SyncRequestBody = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const parsed: unknown = await request.json();
      if (parsed && typeof parsed === "object") {
        body = parsed as SyncRequestBody;
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      );
    }
  }

  if (
    body.type !== undefined &&
    body.type !== "full" &&
    body.type !== "incremental"
  ) {
    return NextResponse.json(
      { error: 'Field "type" must be "full" or "incremental"' },
      { status: 400 },
    );
  }
  if (body.projectKey !== undefined && typeof body.projectKey !== "string") {
    return NextResponse.json(
      { error: 'Field "projectKey" must be a string' },
      { status: 400 },
    );
  }

  const args: RunSyncArgs = {
    type: body.type,
    projectKey: body.projectKey ?? null,
  };

  const result = await runSync(args);
  // 200 on success, 500 on failure. The sync_run row carries the same status.
  return NextResponse.json(result, {
    status: result.status === "success" ? 200 : 500,
  });
}
