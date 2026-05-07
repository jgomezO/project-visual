import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

// Anthropic SDK client for AI assist operations (iter 7).
//
// Lazy-instantiate + cache pattern matches getServerSupabaseAdmin —
// the env-var check throws at first call, not at module load, so a
// build that doesn't actually invoke an AI route handler succeeds
// without ANTHROPIC_API_KEY set.
//
// "server-only" guard prevents accidental client-bundling of the API
// key. Every consumer (route handler, Server Action, helper module)
// must live on the server side; if a client component needs AI
// output, it goes through an SSE route handler that uses this.
export function getAnthropicClient(): Anthropic {
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY. Copy .env.example to .env.local and " +
        "fill in your key from console.anthropic.com.",
    );
  }

  cached = new Anthropic({ apiKey });
  return cached;
}

// Single-source-of-truth model identifier. Pinned to a specific snapshot
// so prompt behavior stays stable across Anthropic releases. To roll
// forward, change this constant + re-test prompt outputs in dev. Do
// NOT swap to a non-snapshotted alias like 'claude-haiku-4-5' — that
// drifts silently when Anthropic updates the alias.
export const AI_MODEL = "claude-haiku-4-5-20251001";
