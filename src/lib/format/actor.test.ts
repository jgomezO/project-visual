import { describe, expect, it } from "vitest";
import { formatActor, formatActorRaw } from "./actor";

// Smoke test (iter 8 commit 1). Two purposes:
//   1. Validate Vitest setup end-to-end (TS imports, vitest config,
//      tsconfig path resolution).
//   2. Lock the actor-formatting contract: NULL / "system" → localized
//      "System" label; everything else → returned unchanged.
//
// formatActor is the simplest helper that hits both branches of the
// codebase's i18n contract — it consumes a Translator function so we
// can verify the localized fallback without booting next-intl.

describe("formatActor", () => {
  // Stand-in translator that mimics narratives.actor.system → "Sistema".
  const t = (key: "system"): string => {
    if (key === "system") return "Sistema";
    return key;
  };

  it("returns the translated 'system' label for null", () => {
    expect(formatActor(null, t)).toBe("Sistema");
  });

  it("returns the translated 'system' label for undefined", () => {
    expect(formatActor(undefined, t)).toBe("Sistema");
  });

  it("returns the translated 'system' label for the literal string 'system'", () => {
    expect(formatActor("system", t)).toBe("Sistema");
  });

  it("returns an email value unchanged (full domain preserved)", () => {
    expect(formatActor("john.gomez@veevart.com", t)).toBe(
      "john.gomez@veevart.com",
    );
  });

  it("returns an empty string as the system label (NULL-equivalent)", () => {
    // Falsy guard in formatActor: !value catches "" along with null/undefined.
    expect(formatActor("", t)).toBe("Sistema");
  });
});

describe("formatActorRaw", () => {
  it("returns null for null", () => {
    expect(formatActorRaw(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(formatActorRaw(undefined)).toBeNull();
  });

  it("returns null for the literal string 'system'", () => {
    expect(formatActorRaw("system")).toBeNull();
  });

  it("returns null for an empty string (NULL-equivalent)", () => {
    expect(formatActorRaw("")).toBeNull();
  });

  it("returns an email value unchanged", () => {
    expect(formatActorRaw("jane@veevart.com")).toBe("jane@veevart.com");
  });
});
