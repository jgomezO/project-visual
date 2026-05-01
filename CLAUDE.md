# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Internal Veevart dashboard that connects to Jira Cloud and surfaces project status, dependencies, and delivery dates for **non-technical audiences** (C-level, Customer Success, Implementations). The product question is "is this project on time?" / "what's blocking it?" / "what changed this week?" — NOT a 200-ticket backlog.

This is the first iteration: a single `/projects` route listing Jira projects in HeroUI cards. Data is fetched live from Jira on every request. No DB, no cache, no auth, no background jobs (yet).

## Stack

- Next.js 16 (App Router) + TypeScript
- React 19, Turbopack (dev and build)
- HeroUI v3 (`@heroui/react`, `@heroui/styles`, `tailwind-variants`)
- Tailwind CSS v4 (CSS-first config, `@tailwindcss/postcss` plugin) — MANDATORY for HeroUI v3
- pnpm 10, ESLint 9
- Node 20+ required (verified on 22)

Planned for later phases (NOT installed yet): Supabase (Postgres + Auth), Recharts, React Flow (dependency graph), TanStack Table, background jobs (Inngest or Trigger.dev — undecided).

## Commands

```bash
pnpm install            # Install deps
pnpm dev                # Dev server at http://localhost:3000 (Turbopack)
pnpm build              # Production build — typechecks, lints, compiles
pnpm start              # Serve the production build
pnpm lint               # ESLint
```

No test runner is configured yet.

## Local setup

1. `cp .env.example .env.local` and fill in:
   - `JIRA_BASE_URL` (e.g. `https://acme.atlassian.net`)
   - `JIRA_EMAIL` (the Atlassian account email)
   - `JIRA_API_TOKEN` (https://id.atlassian.com/manage-profile/security/api-tokens)
   - `JIRA_PROJECT_KEYS` (optional, comma-separated keys; empty = all accessible projects)
2. `pnpm dev`, open http://localhost:3000/projects.

If a required env var is missing, `getJiraEnv()` throws a clear message at first call and `error.tsx` surfaces it in the UI.

## Architecture

```
src/
├── app/
│   ├── layout.tsx           Root layout. globals.css = Tailwind + HeroUI styles.
│   ├── page.tsx             Home — currently a HeroUI smoke test.
│   ├── globals.css          @import "tailwindcss"; @import "@heroui/styles";
│   └── projects/
│       ├── page.tsx         Server Component, force-dynamic. Lists projects + stats.
│       ├── loading.tsx      Skeleton grid (auto-shown via App Router suspense).
│       └── error.tsx        Client error boundary with retry.
└── lib/
    └── jira/
        ├── client.ts        JiraClient (Basic Auth, retry/backoff).
        ├── env.ts           getJiraEnv() validates + caches env vars.
        └── types.ts         JiraProject, ProjectStats, JiraApiError, ...
```

### Jira integration

- All Jira HTTP lives in `JiraClient`. Never `fetch` Jira directly from a component.
- `listProjects()` paginates `GET /rest/api/3/project/search?expand=lead` (50 / page) and applies the optional `JIRA_PROJECT_KEYS` filter client-side.
- `getProjectStats(key)` issues two `POST /rest/api/3/search/approximate-count` calls in parallel — `project = X` and `project = X AND statusCategory = Done` — and computes `donePct`.
- The legacy `GET /rest/api/3/search` endpoint was removed by Atlassian in May 2025; `approximate-count` is the replacement for total counts.
- `429` responses honor `Retry-After`, falling back to exponential backoff (500 / 1000 / 2000 ms), max 3 attempts.

### Server vs Client

- Server Components by default. `"use client"` only when strictly necessary; today only `error.tsx` is client.
- `src/lib/jira/*` imports `"server-only"` to fail loudly if anything bundles it into the client (prevents API-token leakage to the browser).

### HeroUI v3

This is HeroUI **v3**, NOT v2. Key differences vs v2 / NextUI muscle memory:

- **No `<HeroUIProvider>`** — v3 dropped it.
- Components use **dot-notation compound parts**, e.g. `<Card><Card.Header><Card.Title>` — there is **no `.Root` suffix** (that's Radix).
- Buttons take `variant`, **not** `color`. Default = primary; no prop required.
- Use **`onPress`**, not `onClick` (accessibility).
- `globals.css` MUST `@import "tailwindcss"` BEFORE `@import "@heroui/styles"`.
- HeroUI ships semantic Tailwind utilities (`text-muted`, `text-foreground`, `bg-surface*`) — prefer these over raw colors.
- Component docs: `https://heroui.com/docs/react/components/{name}.mdx`. The HeroUI Skill is installed at `~/.claude/skills/heroui-react/` with helper scripts: `node ~/.claude/skills/heroui-react/scripts/get_component_docs.mjs <Component>`. **Fetch v3 docs before using any new component** — the API differs from v2 in non-obvious ways.

### Next.js 16 caveat

The scaffolded `AGENTS.md` warns: "This is NOT the Next.js you know — APIs, conventions, and file structure may all differ from your training data." Before using App Router APIs that may have changed (fetch caching semantics, async `params` / `searchParams`, etc.) read `node_modules/next/dist/docs/`. `/projects` is intentionally `force-dynamic` to skip prerender at build time.

### Workspace root

`next.config.ts` pins `turbopack.root` to `process.cwd()` because there is a stray `package-lock.json` in an ancestor directory (`/Users/veevart/`) that confuses Next's auto-detection.

## Conventions

- **No `any`.** Define explicit TS types for external API responses; omit fields we don't use rather than typing them loosely.
- **Server Components by default.** `"use client"` only when strictly necessary.
- **All Jira HTTP through `JiraClient`** — no loose `fetch` in components.
- **Errors surface explicitly.** Throw `JiraApiError` from the client; the page-level `error.tsx` shows the user a clear state. Never crash the page.
- **Credentials only via env vars.** Document new vars in `.env.example`. **Never log the `Authorization` header or API token**, even in errors.
- **Folders:** `src/app/` (routes), `src/lib/jira/` (client / types / env), `src/components/` (reusable UI), `src/types/` (shared types).

## Known tech debt

- **N+1 calls on `/projects`:** 1 `listProjects` + 2 `approximate-count` per project per request. TODO marker is in `src/lib/jira/client.ts`. To be resolved by persisting projects + stats in Supabase and refreshing in the background.
- **No persistence / auth / cache yet.** Every `/projects` hit goes live to Jira.
- **No tests, no CI yet.**

## Out of scope (do NOT add without asking)

Supabase, user-level auth, Inngest / Trigger.dev, Recharts, React Flow, TanStack Table, new routes beyond `/projects`, any library outside the locked stack.
