import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

// Vitest config (iter 8). Minimal:
// - resolve.tsconfigPaths: true — Vitest 4+ resolves `@/lib/...`
//   imports against tsconfig.json's `paths` natively.
// - resolve.alias['server-only']: stubs the package so server modules
//   under test (which all start with `import "server-only"`) don't
//   crash at import time. The real package throws by design to break
//   client-component bundling — that guard is a false positive in
//   Vitest's Node environment. Production bundling still uses the
//   real package; this alias is scoped to Vitest only.
// - environment: 'node'. iter 8 only tests pure libs — no React
//   component tests, no jsdom needed.
// - include: only `src/**/*.{test,spec}.{ts,tsx}`. Co-located tests.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": path.resolve(here, "./test-utils/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
