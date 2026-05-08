import { describe, expect, it } from "vitest";
import { computeCostUsd } from "./pricing";

// Pricing math is the single point of truth for what we record on
// ai_usage.cost_usd. Bugs here = silently wrong audit logs forever
// (the audit log is immutable; we don't recompute historical rows
// when constants change). High value for low test cost.

describe("computeCostUsd — Anthropic Haiku 4.5 pricing", () => {
  it("zero tokens on both sides → $0.00", () => {
    expect(computeCostUsd({ inputTokens: 0, outputTokens: 0 })).toBe(0);
  });

  it("1,000,000 input tokens alone → exactly $1.00", () => {
    expect(computeCostUsd({ inputTokens: 1_000_000, outputTokens: 0 })).toBe(
      1,
    );
  });

  it("1,000,000 output tokens alone → exactly $5.00", () => {
    expect(computeCostUsd({ inputTokens: 0, outputTokens: 1_000_000 })).toBe(
      5,
    );
  });

  it("mixed input + output sums correctly", () => {
    // 500k input @ $1/M = $0.50; 200k output @ $5/M = $1.00; sum = $1.50.
    expect(
      computeCostUsd({ inputTokens: 500_000, outputTokens: 200_000 }),
    ).toBe(1.5);
  });

  it("typical iter 7 call (~700 input + ~75 output) lands at expected micro-cost", () => {
    // A prompt-v2 call: ~700 input tokens × $1/M = $0.0007.
    // 75 output tokens × $5/M = $0.000375. Total ≈ $0.001075.
    const cost = computeCostUsd({ inputTokens: 700, outputTokens: 75 });
    expect(cost).toBe(0.001075);
  });

  it("rounds to 6 decimals (no JS-float artifacts like 0.0000010000000000000002)", () => {
    // 1 token in + 0 out = $0.000001. Without explicit rounding, JS
    // floats can produce 0.0000010000000000000002 from the division +
    // multiplication chain. The helper must Math.round * 1e6 / 1e6
    // so the value drops cleanly into DECIMAL(10, 6) without truncation.
    const cost = computeCostUsd({ inputTokens: 1, outputTokens: 0 });
    expect(cost).toBe(0.000001);
    // No more than 6 decimal digits when stringified.
    expect(cost.toString()).toMatch(/^0\.000001$|^0\.0+1e-6$|^1e-6$/);
  });

  it("very small mixed values round consistently (smoke test for fractional sum)", () => {
    // 3 input + 7 output = $0.000003 + $0.000035 = $0.000038
    const cost = computeCostUsd({ inputTokens: 3, outputTokens: 7 });
    expect(cost).toBe(0.000038);
  });
});
