import "server-only";

// Anthropic pricing for the model defined in src/lib/ai/client.ts.
// Verified against https://www.anthropic.com/pricing on 2026-05-07.
//
// To update: re-check pricing page, change the constants, bump the
// VERIFIED_AT date in the comment. Cost rows already in ai_usage stay
// at their old values — that's correct: an audit log records what was
// charged at the time, not the latest rate.
//
// Units: USD per 1 million tokens. We compute cost in USD with 6
// decimal places (matching ai_usage.cost_usd DECIMAL(10, 6)) so a
// single 200-token call lands at ~$0.000201, not rounded to zero.
const INPUT_USD_PER_MTOK = 1.0; // claude-haiku-4-5 input
const OUTPUT_USD_PER_MTOK = 5.0; // claude-haiku-4-5 output

export interface CostInputs {
  inputTokens: number;
  outputTokens: number;
}

export function computeCostUsd({
  inputTokens,
  outputTokens,
}: CostInputs): number {
  const inputCost = (inputTokens / 1_000_000) * INPUT_USD_PER_MTOK;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_USD_PER_MTOK;
  // Round to 6 decimals so the value lands cleanly in DECIMAL(10, 6).
  // JavaScript floats can produce e.g. 0.0000010000000000000002.
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
