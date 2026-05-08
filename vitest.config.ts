import { defineConfig } from "vitest/config";

// Vitest config (iter 8). Minimal:
// - resolve.tsconfigPaths: true — Vitest 4+ resolves `@/lib/...`
//   imports against tsconfig.json's `paths` natively. (Earlier
//   versions needed the `vite-tsconfig-paths` plugin; v4 deprecated
//   that path.)
// - environment: 'node'. iter 8 only tests pure libs (sync decision
//   tree, derived progress, pricing, prompts) — no React component
//   tests, no jsdom needed. Faster startup, no DOM globals leaking.
// - include: only `src/**/*.{test,spec}.{ts,tsx}`. Co-located with
//   source per the iter 8 convention.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
