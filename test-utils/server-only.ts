// Stub for the `server-only` package used in Vitest (iter 8).
//
// The real package throws on import to break client-component bundling.
// Tests run in Node (vitest environment='node'), not in an RSC pipeline,
// so the throw is a false-positive — every server module under test
// (`src/lib/sync/*`, `src/lib/narratives/*`, `src/lib/ai/*`, …) imports
// `"server-only"` at the top and would crash at import time without
// this alias.
//
// Wired via `resolve.alias['server-only']` in vitest.config.ts. The
// production bundle still uses the real package — the alias is
// scoped to Vitest only.
export {};
