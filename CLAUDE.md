# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Internal Veevart dashboard that connects to Jira Cloud and surfaces project status, dependencies, and delivery dates for **non-technical audiences** (C-level, Customer Success, Implementations). The product question is "is this project on time?" / "what's blocking it?" / "what changed this week?" — NOT a 200-ticket backlog.

**Iteration 2:** Supabase persists projects, issues, issue_links, and sync_runs. `/projects` reads from Supabase. `POST /api/sync` (or the in-page "Resincronizar" button) pulls fresh data from Jira and upserts. Sync supports incremental mode via a per-project watermark.

**Iteration 3a:** `/projects/[key]` detail view with KPI header (total / % done / overdue / blocked), an expandable issues table grouped by epic with two filter toggles, and a right-side drawer with lazy-loaded relations (parent epic, children, sub-tasks, blocked-by / blocks links).

**Iteration 3b (current):** Roadmap view alongside the list inside `/projects/[key]`. Tabs (Lista | Roadmap) with URL state, range presets and manual date pickers (URL state), epic bars with overdue/in-progress/future colors, today line, clickable out-of-range counter, "Sin planificar" section for active epics missing dates, and reuse of the IssueDrawer for detail. Custom SVG + HTML rendering — no Gantt library.

## Stack

- Next.js 16 (App Router) + TypeScript
- React 19, Turbopack
- HeroUI v3 (`@heroui/react`, `@heroui/styles`, `tailwind-variants`)
- Tailwind CSS v4 (CSS-first config, `@tailwindcss/postcss` plugin)
- Supabase (cloud), `@supabase/supabase-js` direct — no ORM
- `lucide-react` for icons
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
| `JIRA_BASE_URL`                   | server  | `https://<tenant>.atlassian.net` — used by `JiraClient`       |
| `JIRA_EMAIL`                      | server  | Atlassian account email tied to the API token                 |
| `JIRA_API_TOKEN`                  | server  | https://id.atlassian.com/manage-profile/security/api-tokens   |
| `JIRA_PROJECT_KEYS`               | server  | (optional) comma-separated keys to scope `listProjects()`     |
| `NEXT_PUBLIC_JIRA_BASE_URL`       | client  | Same value as `JIRA_BASE_URL`, exposed to the browser only to build "Abrir en Jira" links. Kept separate from `JIRA_BASE_URL` so a renamed server var never leaks the token-bearing host into the client bundle. |
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
│       ├── error.tsx
│       └── [key]/
│           ├── page.tsx            Server Component: project_dashboard RPC + issues query, parses ?view
│           └── not-found.tsx       Custom 404 for unknown project keys
├── components/
│   ├── SyncButton.tsx              Client Component invoking the Server Action
│   └── project/
│       ├── KpiHeader.tsx           Server Component: 4 KPI cards + breadcrumb
│       ├── ProjectViews.tsx        Client: HeroUI Tabs (Lista | Roadmap), URL state for ?view
│       ├── ProjectTable.tsx        Client: filter toggles + epic-grouped table; owns drawer state
│       ├── ProjectRoadmap.tsx     Client: timeline + bars + Sin planificar; owns drawer state
│       ├── IssueDrawer.tsx         Client: lazy-fetches parent / kids / sub-tasks / links
│       ├── StatusChip.tsx          Plain (no "use client") — bundled to client by importers
│       ├── AssigneeCell.tsx        Plain
│       └── DueDateCell.tsx         Plain
└── lib/
    ├── format/
    │   ├── relativeTime.ts         relativeFromNow() — Spanish relative dates
    │   └── roadmapDates.ts         UTC date math + dateToX for the roadmap chart
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
    ├── 20260501113500_init_jira_dashboard_schema.sql
    └── 20260501174714_add_project_dashboard_function.sql
```

### Roadmap view (`?view=roadmap`)

`/projects/[key]` has two tabs — **Lista** (the issues table) and
**Roadmap** (epics on a timeline). State lives entirely in URL query
params:

| Param   | Values                          | Default                                |
| ------- | ------------------------------- | -------------------------------------- |
| `view`  | `list` (default) \| `roadmap`   | `list`                                 |
| `from`  | `YYYY-MM-DD`                    | today (UTC)                            |
| `to`    | `YYYY-MM-DD`                    | today + 6 months (UTC)                 |

`from` / `to` are validated server-side; malformed or `from >= to` falls
back to the default. Range presets ("Este trimestre", "Próximos 6 meses",
"Próximo año", "Todo") write absolute dates to the URL — there is no
"preset code" persisted, so a shared link is a deterministic snapshot.
Manual `<input type="date">` pickers commit on click ("Aplicar"); the
draft state is local until applied. Toggles that are *not* persisted in
URL: **show-completed** (default OFF on every load) — design
decision to keep shareable links anchored to planned work.

Rendering: **custom SVG + HTML, no Gantt library** (gantt-task-react,
frappe-gantt etc.). Bars are absolutely-positioned `<button>`s inside a
flex container with a sticky 240px label column on the left and a
horizontally scrollable timeline on the right. Background grid and
"Hoy" line are SVG; bars and labels are HTML so HeroUI Tooltip /
Popover wrap them naturally. `dateToX` lives in
`src/lib/format/roadmapDates.ts` — UTC math throughout to keep
positioning timezone-independent.

Bar buckets (each sorted by `due_date` ASC inside the bucket):
1. **overdue** — red, due in past, status not Done
2. **inProgress** — light blue, with darker overlay from `start` to today
3. **future** — gray, start in the future
4. **done** — green; only rendered when the show-completed toggle is on

**Done with missing dates** are hidden everywhere: not in the chart
(no positions to compute), not in "Sin planificar" (which only surfaces
**non-Done** epics that need follow-up). The toggle only reveals Done
epics that *have* both dates.

Clipping: bars whose visible interval extends past either chart edge
clamp to the visible window and gain a discreet ChevronLeft /
ChevronRight on the clamped edge. Bars entirely outside the range
don't render a row; instead they surface in a clickable counter
(HeroUI Popover) — turning the count from dead information into a
recoverable view.

`<input type="date">` is a deliberate fallback over HeroUI v3's
DatePicker: native pickers are locale-aware via the browser, no extra
React-side i18n risk. **TODO:** swap to HeroUI DatePicker once `es-AR`
locale support is verified end-to-end.

### Custom field mapping

Jira custom-field ids are tenant-specific. The mapping lives in
`src/lib/jira/types.ts` as named constants so a re-targeting to another
Jira instance only requires re-running `GET /rest/api/3/field` and
updating the constants — no scattered string matches.

| DB column        | Jira field          | Constant                     | Type / format    |
| ---------------- | ------------------- | ---------------------------- | ---------------- |
| `issues.start_date` | `customfield_10015` ("Start date") | `JIRA_START_DATE_FIELD_ID` | `YYYY-MM-DD`     |

Sync requests `fields=["*all"]`, so adding a new mapping is type/parse-only — the value is already in the response. Always parse with a regex / type-guard helper (e.g. `parseJiraDate`) and fall back to NULL on malformed values rather than letting a one-off bad string break the whole upsert. **TODO:** parametrize via env if a second Jira instance ever gets onboarded.

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

### `/projects/[key]` detail view

- **`project_dashboard(p_project_key TEXT)` RPC** (in
  `20260501174714_add_project_dashboard_function.sql`, granted to `anon`
  + `authenticated`): one round-trip aggregate that returns
  `{project_id, project_key, project_name, lead_display_name, last_synced_at, total, todo_count, in_progress_count, done_count, overdue_count, blocked_count}`.
  When the project key doesn't exist it returns zero rows — the page
  treats that (and a null `project_id`) as `notFound()`.
- **`overdue_count` semantics:** `due_date < CURRENT_DATE AND status_category <> 'Done'`. Done issues never count as overdue, even if the due date has passed.
- **`blocked_count` semantics:** distinct count of issues that have an
  outgoing `issue_links` row with `lower(link_type) = 'is blocked by'`
  AND the issue's own `status_category <> 'Done'`. Counts the
  *blocked* issue, not the blocker. `lower()` is intentional — Jira
  occasionally returns mixed-case link types.
- **Issues table query:** filters out sub-tasks at the SQL boundary
  (`.not("issue_type", "ilike", "%Sub-task%")`) so they only appear
  inside the drawer. Sort: `due_date ASC NULLS LAST, key ASC`.
- **Bucketing into "Sin épica":** stories / tasks / bugs whose
  `parent_id` is NULL **or** whose parent is *not* an Epic (e.g. a
  Story under a Task — unusual but possible) bucket into "Sin épica".
  Only Epics show as group headers.
- **Epic expansion default:** epics expand by default unless
  `status_category = 'Done'`. Per-epic overrides live in a `Map<id,
  boolean>` inside `ProjectTable` so toggling one epic doesn't affect
  others.
- **Drawer (`IssueDrawer`):** controlled via
  `<Drawer.Backdrop isOpen onOpenChange>` — HeroUI v3's controlled API
  does **not** wrap with `<Drawer>`. The drawer renders the
  `IssueRow`'s data instantly and lazy-fetches parent / kids /
  sub-tasks / links via the browser-side anon Supabase client.
  Sub-tasks are matched with `/sub-?task/i`.

### Server vs Client

- Server Components by default. `"use client"` only when strictly necessary (today: `error.tsx`, `SyncButton.tsx`, `ProjectViews.tsx`, `ProjectTable.tsx`, `ProjectRoadmap.tsx`, `IssueDrawer.tsx`).
- The leaf cells `StatusChip` / `AssigneeCell` / `DueDateCell` are **plain components** (no `"use client"` directive) — they get bundled to the client when imported by `ProjectTable`, but they don't add new Server/Client boundaries. Don't add `"use client"` to them.
- `src/lib/jira/*`, `src/lib/sync/*`, `src/lib/supabase/service.ts` import `"server-only"`. Guards the Jira API token and the Supabase service-role key from accidental client bundling.
- `/api/sync` is the HTTP entry point (gated by `SYNC_SECRET`) for external callers (ops, future cron). The dashboard's "Resincronizar" button uses a Server Action (`triggerSync`) that calls `runSync()` directly — no `SYNC_SECRET` exposed to the browser.

### Database

Schema in `supabase/migrations/20260501113500_init_jira_dashboard_schema.sql`. Tables:

- `projects` — PK = Jira project id (TEXT), unique `key`, lead, `raw` jsonb, `last_synced_at`.
- `issues` — PK = Jira issue id (TEXT), unique `key`, `project_id` FK CASCADE, `status_category` CHECK ('To Do' | 'In Progress' | 'Done'), `parent_id` self-FK SET NULL, `due_date`, `start_date`, jira+local timestamps, `raw` jsonb.
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

`AGENTS.md` (created by the scaffold) warns: "This is NOT the Next.js you know — APIs may differ from your training data." Read `node_modules/next/dist/docs/` before using App Router APIs that may have changed. `/projects`, `/projects/[key]`, and `/api/sync` are intentionally `force-dynamic`. `next.config.ts` pins `turbopack.root` to `process.cwd()` to ignore an ancestor `package-lock.json` (`/Users/veevart/`).

In dev mode, `notFound()` from a route handler returns HTTP 200 with the not-found UI — production correctly returns 404. Custom `not-found.tsx` files render in both modes.

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
- **`/projects/[key]` issues table is not virtualized.** Fine for the current scale (NOXSCRUM has ~813 issues, render is snappy). At ~2000+ rows, switch to a virtualized renderer or paginate server-side. The bucketize/filter passes are O(n); the cost is in the DOM.
- **`/projects/[key]` roadmap is not virtualized.** Designed for ~10x current scale (~270 epics). The chart renders one absolutely-positioned `<button>` per visible epic plus a couple of SVG lines per week — at 270 epics × month-ranged ranges that's ~300 DOM nodes, fine. At 2000+ epics consider virtualizing the chart body rows (the left label column would virtualize in lockstep) and pre-bucketing on the server.
- **Drawer link enrichment runs a second `in()` query** to fetch summary/status for linked targets. At ~10s of links per issue this is fine; consider a single SQL function with JOINs if drawers feel slow.
- **No tests, no CI yet.**
- **No realtime updates** — the page is a static-ish render until reload or a click on Resincronizar.

## Out of scope (do NOT add without asking)

User-level auth, cron jobs, Inngest / Trigger.dev, Recharts, React Flow, TanStack Table, **Gantt libraries** (gantt-task-react, frappe-gantt, etc. — the roadmap is intentionally hand-rolled SVG + HTML), new routes beyond `/projects`, `/projects/[key]`, and `/api/sync`, any library outside the locked stack.
