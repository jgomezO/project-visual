# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Internal Veevart dashboard that connects to Jira Cloud and surfaces project status, dependencies, and delivery dates for **non-technical audiences** (C-level, Customer Success, Implementations). The product question is "is this project on time?" / "what's blocking it?" / "what changed this week?" — NOT a 200-ticket backlog.

**Iteration 2 (current):** Supabase persists projects, issues, issue_links, and sync_runs. `/projects` reads from Supabase. `POST /api/sync` (or the in-page "Resincronizar" button) pulls fresh data from Jira and upserts. Sync supports incremental mode via a per-project watermark.

## Stack

- Next.js 16 (App Router) + TypeScript
- React 19, Turbopack
- HeroUI v3 (`@heroui/react`, `@heroui/styles`, `tailwind-variants`)
- Tailwind CSS v4 (CSS-first config, `@tailwindcss/postcss` plugin)
- Supabase (cloud), `@supabase/supabase-js` direct — no ORM
- pnpm 10, ESLint 9
- Node 20+ (verified on 22)

Planned for later phases (NOT installed): Recharts, React Flow, TanStack Table, background jobs (Inngest or Trigger.dev — undecided), user-level auth.

## Commands

```bash
pnpm install            # Install deps
pnpm dev                # Dev server at http://localhost:3000 (Turbopack)
pnpm build              # Production build — typechecks, lints, compiles
pnpm start              # Serve the production build
pnpm lint               # ESLint
pnpm gen:types          # Regenerate src/lib/supabase/types.ts from the linked project
```

Database migrations:

```bash
supabase db push                    # Apply pending migrations to the linked project
supabase migration new <name>       # Create a new timestamped migration
supabase migration list             # Show applied vs pending
```

**After every new migration, run `pnpm gen:types`** to refresh `src/lib/supabase/types.ts`.

No test runner configured yet.

## Environment variables

| Variable                          | Side    | Purpose                                                       |
| --------------------------------- | ------- | ------------------------------------------------------------- |
| `JIRA_BASE_URL`                   | server  | `https://<tenant>.atlassian.net`                              |
| `JIRA_EMAIL`                      | server  | Atlassian account email tied to the API token                 |
| `JIRA_API_TOKEN`                  | server  | https://id.atlassian.com/manage-profile/security/api-tokens   |
| `JIRA_PROJECT_KEYS`               | server  | (optional) comma-separated keys to scope `listProjects()`     |
| `NEXT_PUBLIC_SUPABASE_URL`        | client  | Project URL (Project Settings → API)                          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | client  | Safe to ship to browser; gated by RLS                         |
| `SUPABASE_SERVICE_ROLE_KEY`       | server  | **SERVER-ONLY**, bypasses RLS, never log                      |
| `SYNC_SECRET`                     | server  | Required by `POST /api/sync` via `x-sync-secret` header       |

Document every new var in `.env.example` with inline notes on which side it lives.

## Local setup (fresh clone)

1. Create a Supabase cloud project (https://supabase.com), copy URL + anon key + service-role key into `.env.local`.
2. `SYNC_SECRET=$(openssl rand -hex 32)` → `.env.local`.
3. Add Jira creds (URL, email, API token) to `.env.local`.
4. `supabase link --project-ref <ref>` (the ref is the subdomain of `NEXT_PUBLIC_SUPABASE_URL`).
5. `supabase db push` to apply migrations.
6. `pnpm install && pnpm dev`.
7. Open `/projects`. Empty state has a "Sincronizar ahora" button; or trigger via curl below.

### Manual sync (curl)

```bash
# Incremental, all configured projects
curl -X POST -H "x-sync-secret: $SYNC_SECRET" \
  http://localhost:3000/api/sync

# Full re-sync of one project
curl -X POST \
  -H "x-sync-secret: $SYNC_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"type":"full","projectKey":"NOXSCRUM"}' \
  http://localhost:3000/api/sync
```

Returns the resulting `sync_run` row plus stats. 200 on success, 500 on failure (the row is also marked `failed` with `error_message`).

## Architecture

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css                 @import "tailwindcss"; @import "@heroui/styles";
│   ├── api/sync/route.ts           POST /api/sync (x-sync-secret guard)
│   └── projects/
│       ├── page.tsx                Server Component, reads from Supabase
│       ├── actions.ts              Server Action triggerSync()
│       ├── loading.tsx
│       └── error.tsx
├── components/
│   └── SyncButton.tsx              Client Component invoking the Server Action
└── lib/
    ├── jira/
    │   ├── client.ts               JiraClient: listProjects, getProjectStats, searchIssues(Paginated)
    │   ├── env.ts                  getJiraEnv()
    │   └── types.ts
    ├── supabase/
    │   ├── service.ts              getServiceSupabase() — service-role, server-only
    │   ├── anon.ts                 getAnonSupabase() — anon key, RLS-gated reads
    │   └── types.ts                GENERATED by `pnpm gen:types`
    └── sync/
        ├── index.ts                runSync({type?, projectKey?}); describeError() handles PostgrestError
        ├── projects.ts             syncProjects()
        ├── issues.ts               syncIssuesForProject() — parent_id 2nd pass + link backfill
        └── runs.ts                 sync_run lifecycle (open / succeed / fail)

supabase/
├── config.toml
└── migrations/
    └── 20260501113500_init_jira_dashboard_schema.sql
```

### Sync flow

1. `runSync()` opens a `sync_runs` row with `status='running'`.
2. `syncProjects(jira)` upserts every project from `listProjects()` into `projects`.
3. For each project: `syncIssuesForProject(jira, key)`:
   - Watermark = `projects.last_synced_at - 1 day` (date-only). The 1-day buffer absorbs Jira's TZ ambiguity in JQL date strings (Jira interprets them in the token user's timezone).
   - Streams pages via `searchIssuesPaginated` (cursor: `nextPageToken`). The legacy `/rest/api/3/search` was removed by Atlassian in May 2025.
   - Upserts issues by PK with `parent_id=null`, then **backfills `parent_id` in a second pass** to avoid self-FK violations when an issue and its parent (epic→story or task→subtask) are in the same upsert batch.
   - Upserts `issue_links` by `(source_issue_id, target_issue_key, link_type)`. `target_issue_id` may be NULL when the target is in a project we haven't synced; `target_issue_key` is always set so the FK can be backfilled later.
   - Updates `projects.last_synced_at` on success.
4. Aggregated stats (`issuesCreated`, `issuesUpdated`, `linksSkipped`) plus `jql_used` are written by `succeedRun` / `failRun`. On any thrown exception, the run is marked `failed` with `error_message` — never left in `running`.

### Server vs Client

- Server Components by default. `"use client"` only when strictly necessary (today: `error.tsx`, `SyncButton.tsx`).
- `src/lib/jira/*`, `src/lib/sync/*`, `src/lib/supabase/service.ts` import `"server-only"`. Guards the Jira API token and the Supabase service-role key from accidental client bundling.
- `/api/sync` is the HTTP entry point (gated by `SYNC_SECRET`) for external callers (ops, future cron). The dashboard's "Resincronizar" button uses a Server Action (`triggerSync`) that calls `runSync()` directly — no `SYNC_SECRET` exposed to the browser.

### Database

Schema in `supabase/migrations/20260501113500_init_jira_dashboard_schema.sql`. Tables:

- `projects` — PK = Jira project id (TEXT), unique `key`, lead, `raw` jsonb, `last_synced_at`.
- `issues` — PK = Jira issue id (TEXT), unique `key`, `project_id` FK CASCADE, `status_category` CHECK ('To Do' | 'In Progress' | 'Done'), `parent_id` self-FK SET NULL, `due_date`, jira+local timestamps, `raw` jsonb.
- `issue_links` — BIGINT identity PK, `source_issue_id` FK, `target_issue_id` nullable FK, `target_issue_key` NOT NULL, unique on `(source, target_key, link_type)`.
- `sync_runs` — `status` running/success/failed, `sync_type` full/incremental, `project_key` (NULL = all), stats counters, `jql_used`, `error_message`.

`raw` jsonb policy: **never query from UI**. If a field becomes recurrent, extract it to a typed column in a follow-up migration.

RLS: enabled on all four tables; SELECT policy `USING(true)` for `anon`. Service role bypasses RLS for sync writes. Tighten when user auth lands.

### HeroUI v3

- **No `<HeroUIProvider>`** (v3 dropped it).
- Compound components use dot-notation, e.g. `<Card><Card.Header><Card.Title>`. There is **no `.Root` suffix** (that's Radix).
- Buttons use `variant`, NOT `color`. Default = primary; no prop required.
- Use `onPress`, NOT `onClick`.
- `globals.css` MUST `@import "tailwindcss"` BEFORE `@import "@heroui/styles"`.
- HeroUI ships semantic Tailwind utilities (`text-muted`, `text-foreground`, `bg-surface*`, `text-danger`) — prefer these over raw colors.
- **`Card.Description` renders a `<p>`** — don't nest `<div>` inside it (e.g. `<Skeleton>`). Use bare divs in skeleton layouts instead.
- Component docs: `https://heroui.com/docs/react/components/{name}.mdx`. Skill at `~/.claude/skills/heroui-react/`; helper: `node ~/.claude/skills/heroui-react/scripts/get_component_docs.mjs <Component>`. Always fetch v3 docs before using a component you haven't used.

### Next.js 16 caveat

`AGENTS.md` (created by the scaffold) warns: "This is NOT the Next.js you know — APIs may differ from your training data." Read `node_modules/next/dist/docs/` before using App Router APIs that may have changed. `/projects` and `/api/sync` are intentionally `force-dynamic`. `next.config.ts` pins `turbopack.root` to `process.cwd()` to ignore an ancestor `package-lock.json` (`/Users/veevart/`).

## Conventions

- **No `any`.** Define explicit TS types for external API responses.
- **Server Components by default.** `"use client"` only when strictly necessary.
- **All Jira HTTP via `JiraClient`.** No loose `fetch` in components.
- **All Supabase reads via `getAnonSupabase()`.** **All Supabase writes via `getServiceSupabase()`** from server-only modules.
- **Errors surface explicitly.** Sync errors pass through `describeError()` (handles Supabase `PostgrestError`, which is NOT an Error instance) and persist on `sync_runs.error_message`.
- **Credentials only via env vars.** Document every new one in `.env.example`. Never log the Authorization header, the Jira API token, or the Supabase service-role key — even on error paths.
- **Folders:** `src/app/` (routes), `src/lib/jira/`, `src/lib/supabase/`, `src/lib/sync/`, `src/components/`, `src/types/`.
- **`raw` jsonb columns are not for UI consumption.** If you find yourself reading a recurrent field from `raw`, promote it to a typed column in a new migration.

## Known tech debt

- **Issue deletion is not detected.** Jira doesn't expose a "what was deleted since X" endpoint cheaply. When it matters: periodic full sync that lists all current ids and diffs.
- **Watermark uses a 1-day buffer (date-only)** to dodge JQL TZ ambiguity. Refine to a TZ-aware timestamp (using the token user's `/myself.timeZone`) when volume justifies it.
- **Issue link backfill is a global SELECT each sync.** Fine while link counts are low; switch to per-source filtering or a SQL function when slow.
- **`/projects` aggregations are computed in app code** (one query for all issues, group in JS). Promote to a Postgres view (`project_stats`) once project count grows.
- **No tests, no CI yet.**
- **No realtime updates** — the page is a static-ish render until reload or a click on Resincronizar.

## Out of scope (do NOT add without asking)

User-level auth, cron jobs, Inngest / Trigger.dev, Recharts, React Flow, TanStack Table, new routes beyond `/projects` and `/api/sync`, any library outside the locked stack.
