# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Internal Veevart dashboard that connects to Jira Cloud and surfaces project status, dependencies, and delivery dates for **non-technical audiences** (C-level, Customer Success, Implementations). The product question is "is this project on time?" / "what's blocking it?" / "what changed this week?" — NOT a 200-ticket backlog.

**Iteration 2:** Supabase persists projects, issues, issue_links, and sync_runs. `/projects` reads from Supabase. `POST /api/sync` (or the in-page "Resincronizar" button) pulls fresh data from Jira and upserts. Sync supports incremental mode via a per-project watermark.

**Iteration 3a:** `/projects/[key]` detail view with KPI header (total / % done / overdue / blocked), an expandable issues table grouped by epic with two filter toggles, and a right-side drawer with lazy-loaded relations (parent epic, children, sub-tasks, blocked-by / blocks links).

**Iteration 3b:** Roadmap view alongside the list inside `/projects/[key]`. Tabs (Lista | Roadmap) with URL state, range presets and manual date pickers (URL state), epic bars with overdue/in-progress/future colors, today line, clickable out-of-range counter, "Sin planificar" section for active epics missing dates, and reuse of the IssueDrawer for detail. Custom SVG + HTML rendering — no Gantt library.

**Iteration 4a:** Data layer for `/projects/[key]/narrative` (the human-written presentation layer for board / customer / C-level audiences). Three Supabase tables (`project_narratives`, `narrative_phases`, `narrative_workstreams`), composite-FK consistency for workstream/phase scoping, RLS read-open + service-role writes, typed query/mutation helpers in `src/lib/narratives/`, and an idempotent dev seeder (`pnpm seed:narrative`).

**Iteration 4b:** Narrative editor UI. List page at `/projects/[key]/narratives` with create / duplicate / delete + draft / published badges; editor at `/projects/[key]/narratives/[id]/edit` with a structure sidebar (narrative root + phases + orphan workstreams) and a context form panel. Auto-save with 1500ms debounce, indicator in the header, flush-on-tree-navigate guard. Jira issue autocomplete from the anon Supabase client with module-level chip cache.

**Iteration 4c:** Public narrative view at `/projects/[key]/narratives/[id]/preview` — the read-only presentation surface for sharing with C-level / CS / stakeholders. Server Component loads the narrative + a single batched issues query, computes derived stats (per-workstream progress / overdue / missing-from-sync, per-phase progress with manual override, global aggregates), and renders header → status summary → phase sections → orphan workstreams. Progressive disclosure (overview "Leer más", rationale "Ver el por qué", workstream "Ver detalles" + issues list). Presentation mode toggleable via `?mode=presentation` (URL state, ESC exits). Print stylesheet expands every collapsible. Responsive desktop-first but degrades on mobile.

**Iteration 4c.1:** Honesty pass on the public view. Each `IssueChip` now shows an issue-type icon (Epic/Zap púrpura, Story/BookmarkPlus verde, Task/CheckSquare azul, Bug/Bug rojo, Sub-task/CornerDownRight gris, Otro/Circle) with ES tooltip — the lay reader can tell at a glance what level of work each row is. Progress is no longer binary done/not-done: `loadIssuesForNarrative` fetches the full hierarchy closure (initial keys + recursive parent→children passes capped at depth 4) and `computeIssueProgress` walks it (leaf → 100/0 by Done; non-leaf → average of children). Workstream progress = average across directly-linked issues using their recursive value; global progress = average across ALL workstreams (phase + orphan equally weighted). New permanent dev page `/dev/components-preview` for visual validation of new components.

**Iteration 4d:** Cross-team dependencies inside a narrative — modeled, edited, and surfaced. New table `narrative_dependencies` with manual `commitment_status` (proposed/agreed/confirmed/at_risk/blocked), two independent dates (`needed_by_date` vs `expected_delivery_date`), free-text PoD with optional Jira project key link, and provider issue keys. The editor sidebar gains an always-visible "Dependencias" group with full CRUD + reorder; `DependencyForm` adds auto-save, `PodAutocompleteInput` (suggests against the local `projects` table), and `JiraIssueKeysInput` is extended with a `providerProjectKey?` filter. The public preview ships a `DependenciesSection` (`#dependencias` anchor, omitted on zero deps), `DependencyCard` with risk-level lateral border + dot/badge, `DateGapIndicator` (red/green/neutral), `CommitmentStatusChip` (5 ES variants). Header counter "N dependencias" + "⚠ N en estado crítico" anchor-link to the section; `scroll-behavior: smooth` honors `prefers-reduced-motion`.

**Iteration 4e:** Risks declared inside a narrative + stable per-narrative identifiers. New table `narrative_risks` (title, description, severity low/medium/high, `impacts TEXT[]` and `mitigations TEXT[]` with `cardinality >= 1` CHECKs, `related_dependency_ids UUID[]` with no FK on array elements). Stable identifiers `R1, R2, ...` and `D1, D2, ...` are auto-assigned via `claim_next_risk_identifier(uuid)` / `claim_next_dependency_identifier(uuid)` RPCs that atomically increment per-narrative counter columns (`next_risk_id`, `next_dependency_id`) on `project_narratives` — counters never decrease, so deletes don't reuse identifiers. Editor sidebar gains a "Riesgos" group with the same shape as Dependencies; `RiskForm` uses a reusable `BulletListInput` for impacts/mitigations and a toggle-chip picker for related dependencies. Public preview ships `RisksSection` (`#riesgos` anchor, omitted on zero risks) with `RiskCard` (severity-bordered, identifier chip, impacts/mitigations bullet sections, related-dep chips anchor-linked to `#dep-{id}`); `DependencyCard` reciprocates with a "Mencionada por" footer of risk chips → `#risk-{id}`. Header gains "N riesgos" + "⚠ N de severidad alta" counters anchor-linked to `#riesgos`. `NarrativeForm` adds an optional `risks_section_subtitle` field. Preview page is refactored to the canonical Query Waves shape (Wave 1: narrative + project parallel; Wave 2: issue closure; pure compute).

**Iteration 4f (current):** Google OAuth via Supabase Auth, restricted to `@veevart.com` (whitelist via `ALLOWED_EMAIL_DOMAINS`) with a per-user check against Jira's user search. New `user_profiles` table mirrors `auth.users` and caches the resolved Jira `accountId` so subsequent logins skip the API hit. `/login` + `/auth/callback` route handler enforce the two gates; failed gates sign the user out and redirect to `/login?error=domain|jira|unknown`. New middleware refreshes the Supabase session via `getUser()` (validated against the auth server, never `getSession()` which trusts cookies) and gates every path except `/login`, `/auth/callback`, `/api/sync`, `/api/cron/*`. Three Supabase clients now: `getServerSupabase` (cookies-aware, default for app reads/writes via authenticated session), `getServerSupabaseAdmin` (service-role bypass for sync, seed, scripts), `getAnonSupabase` (browser-side public reads in autocompletes). RLS tightened: narrative tables drop `anon_read` and gain `auth_all` on `authenticated`; Jira tables (`projects`, `issues`, `issue_links`, `sync_runs`) get a parallel `authenticated` SELECT policy alongside the existing `anon` one. `created_by` / `updated_by` get stamped with the actor's email by Server Actions (`getActor` helper); the new `formatActor` helper renders `null` / `"system"` as **"Sistema"** in the UI. UserMenu (avatar + Dropdown with email + logout) sits in every primary header except `/preview`.

## Stack

- Next.js 16 (App Router) + TypeScript
- React 19, Turbopack
- HeroUI v3 (`@heroui/react`, `@heroui/styles`, `tailwind-variants`)
- Tailwind CSS v4 (CSS-first config, `@tailwindcss/postcss` plugin)
- Supabase (cloud), `@supabase/supabase-js` direct — no ORM
- `lucide-react` for icons
- pnpm 10, ESLint 9
- Node 20+ (verified on 22)

Planned for later phases (NOT installed): Recharts, React Flow, TanStack Table, background jobs (Inngest or Trigger.dev — undecided).

Auth: Supabase Auth + `@supabase/ssr` (Google OAuth via the configured Supabase provider). Installed in iter 4f.

## Commands

```bash
pnpm install            # Install deps
pnpm dev                # Dev server at http://localhost:3000 (Turbopack)
pnpm build              # Production build — typechecks, lints, compiles
pnpm start              # Serve the production build
pnpm lint               # ESLint
pnpm gen:types          # Regenerate src/lib/supabase/types.ts from the linked project
pnpm seed:narrative     # Dev-only: idempotent demo narrative on NOXSCRUM (uses tsx + service role)
pnpm diag:runs          # Dev-only: print recent sync_runs + per-project issue / link counts
pnpm diag:runs:reap     # Same + mark sync_runs stuck in 'running' >5min as 'failed'
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
| `ALLOWED_EMAIL_DOMAINS`           | server  | Comma-separated whitelist for Google OAuth login. Server-only. Domain check fails closed if unset/empty (refuses every login). |

Document every new var in `.env.example` with inline notes on which side it lives.

## Local setup (fresh clone)

1. Create a Supabase cloud project (https://supabase.com), copy URL + anon key + service-role key into `.env.local`.
2. `SYNC_SECRET=$(openssl rand -hex 32)` → `.env.local`.
3. Add Jira creds (URL, email, API token) to `.env.local`.
4. Add `ALLOWED_EMAIL_DOMAINS=veevart.com` to `.env.local`.
5. `supabase link --project-ref <ref>` (the ref is the subdomain of `NEXT_PUBLIC_SUPABASE_URL`).
6. `supabase db push` to apply migrations.
7. **Auth setup (manual, one-time)**: Google Cloud Console → create OAuth 2.0 Client (Web application) with redirect URI `https://<ref>.supabase.co/auth/v1/callback`. Paste Client ID + Secret into Supabase → Authentication → Providers → Google. Set Supabase Site URL + Redirect URLs (add `http://localhost:3000/auth/callback`). Detailed steps in the migration `20260505145650_add_user_profiles_and_grant_rpc_to_authenticated.sql`.
8. `pnpm install && pnpm dev`.
9. Open `/login`, log in with a `@veevart.com` account that has Jira access. After auth lands you'll see `/projects`; if it's empty, the "Sincronizar ahora" button or the curl below trigger an initial sync.

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
├── middleware.ts                    (NEW iter 4f) Auth gate. Refreshes session via getUser; redirects unauth → /login
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css                 @import "tailwindcss"; @import "@heroui/styles";
│   ├── api/sync/route.ts           POST /api/sync (x-sync-secret guard)
│   ├── login/
│   │   ├── page.tsx                (NEW iter 4f) Server: card with error banner + LoginButton
│   │   └── LoginButton.tsx         (NEW iter 4f) Client: signInWithOAuth via createBrowserClient
│   ├── auth/callback/route.ts      (NEW iter 4f) Code exchange + domain check + Jira verify + cache
│   ├── dev/components-preview/     Permanent dev tool: visual bench for components (not linked from prod)
│   │   └── page.tsx
│   └── projects/
│       ├── page.tsx                Server Component, reads from Supabase, mounts UserMenu
│       ├── actions.ts              Server Action triggerSync()
│       ├── loading.tsx
│       ├── error.tsx
│       └── [key]/
│           ├── page.tsx            Server Component: project_dashboard RPC + issues query, parses ?view
│           ├── not-found.tsx       Custom 404 for unknown project keys
│           └── narratives/
│               ├── page.tsx        Server Component: list narratives for a project + UserMenu
│               └── [id]/
│                   ├── edit/page.tsx     Server Component: load narrative + currentUser, hand off to EditorShell
│                   └── preview/page.tsx  Server Component: load narrative + batched issues + derived stats
├── app/actions/
│   ├── auth.ts                     (NEW iter 4f) "use server" — logoutAction
│   └── narratives.ts               "use server" — every narrative mutation as a Server Action; resolves actor + stamps created_by/updated_by
├── components/
│   ├── SyncButton.tsx              Client Component invoking the Server Action
│   ├── UserMenu.tsx                (NEW iter 4f) Client: avatar trigger + Dropdown (email + Cerrar sesión)
│   ├── narrative-list/
│   │   ├── NarrativeCard.tsx       Card + 3-dot menu (Duplicar / Eliminar) + draft / published badge
│   │   └── NewNarrativeButton.tsx  "Nueva narrativa" CTA + creation modal
│   ├── narrative-editor/
│   │   ├── EditorShell.tsx         Tree state + selection + flush-on-navigate guard
│   │   ├── StructureSidebar.tsx    Tree UI + create / delete / move / reorder actions
│   │   ├── ActiveFormPanel.tsx     Routes the right form to the right entity by selection
│   │   ├── NarrativeForm.tsx       useAutoSave for title / subtitle / overview / status_summary
│   │   ├── PhaseForm.tsx           useAutoSave for name / objective / rationale / status / dates / progress
│   │   ├── WorkstreamForm.tsx      useAutoSave for name / description / phase_id / jira_issue_keys
│   │   ├── DependencyForm.tsx      useAutoSave for the full narrative_dependency record
│   │   ├── DependenciesListPanel.tsx  Group panel: list of dependency cards + delete
│   │   ├── RiskForm.tsx            useAutoSave for the full narrative_risk record (BulletListInput x2 + dep toggle chips)
│   │   ├── RisksListPanel.tsx      Group panel: list of risk cards + delete
│   │   ├── BulletListInput.tsx     Reusable TEXT[] editor (rows + Enter-to-add + max ceiling, default 10)
│   │   ├── PodAutocompleteInput.tsx   Free-text PoD with autocomplete against `projects`
│   │   ├── JiraIssueKeysInput.tsx  Anon-client autocomplete + module-level chip cache; optional `providerProjectKey` rescopes
│   │   ├── AutosaveIndicator.tsx   Saving / Saved / Error pill + Reintentar
│   │   └── useAutoSave.ts          Debounced auto-save hook with imperative flush()
│   ├── narrative-public/
│   │   ├── NarrativeView.tsx           Top-level layout, data-mode wrapper, draft banner mount
│   │   ├── NarrativeHeader.tsx         Client: title/subtitle/meta + overview "Leer más" + deps counter
│   │   ├── StatusSummaryCard.tsx       Server: blue-accent card with status_summary
│   │   ├── DraftBanner.tsx             Server: amber strip when published === false
│   │   ├── PhaseSection.tsx            Client: status palette + rationale toggle + progress bar
│   │   ├── WorkstreamCard.tsx          Client: collapsed/expanded with issues list
│   │   ├── IssueChip.tsx               Server: issue row + warning state for missing-from-sync
│   │   ├── issueTypeIcon.tsx           Server: type→icon+tooltip map (Epic/Story/Task/Bug/Sub-task)
│   │   ├── DependenciesSection.tsx     Server: section under #dependencias; omitted on zero deps
│   │   ├── DependencyCard.tsx          Server: risk-level border + identifier chip + provider block + dates + status + coordination + reverse risk-mention footer
│   │   ├── DateGapIndicator.tsx        Server: red/green/neutral chip for delayRiskDays
│   │   ├── CommitmentStatusChip.tsx    Server: 5 ES variants for commitment_status
│   │   ├── RisksSection.tsx            Server: section under #riesgos; omitted on zero risks
│   │   ├── RiskCard.tsx                Server: severity-bordered card; identifier + impacts/mitigations bullets + related-dep chips
│   │   ├── SeverityBadge.tsx           Server: low/medium/high pill (gris/amber/rojo)
│   │   └── PresentationModeToggle.tsx  Client: ?mode= URL state + ESC handler
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
    ├── auth/                            (NEW iter 4f)
    │   ├── domain-check.ts              isAllowedDomain(email): reads ALLOWED_EMAIL_DOMAINS, fails closed
    │   ├── verify-jira-user.ts          verifyUserInJira(email) → accountId | null (5s timeout, fail-closed)
    │   ├── get-actor.ts                 getActor() → { id, email } from session, throws if no user
    │   └── get-current-user.ts          getCurrentUser() → user + display_name from user_profiles, for UserMenu
    ├── format/
    │   ├── relativeTime.ts         relativeFromNow() — Spanish relative dates
    │   ├── roadmapDates.ts         UTC date math + dateToX for the roadmap chart
    │   └── actor.ts                (NEW iter 4f) formatActor() — null/"system" → "Sistema"
    ├── jira/
    │   ├── client.ts               JiraClient: listProjects, getProjectStats, searchIssues(Paginated)
    │   ├── env.ts                  getJiraEnv()
    │   └── types.ts
    ├── supabase/
    │   ├── server.ts               (NEW iter 4f) getServerSupabase() — async, cookies-aware, default for app code
    │   ├── service.ts              getServerSupabaseAdmin() — service-role, server-only, for sync/seed/scripts
    │   ├── anon.ts                 getAnonSupabase() — anon key, browser-side autocompletes only
    │   └── types.ts                GENERATED by `pnpm gen:types`
    ├── sync/
    │   ├── index.ts                runSync({type?, projectKey?}); describeError() handles PostgrestError
    │   ├── projects.ts             syncProjects()
    │   ├── issues.ts               syncIssuesForProject() — parent_id 2nd pass + link backfill
    │   └── runs.ts                 sync_run lifecycle (open / succeed / fail)
    └── narratives/
        ├── types.ts                Re-exports + NarrativeWithChildren composite (phases, orphans, dependencies, risks)
        ├── queries.ts              getNarrativesByProject / getNarrativeById / getPublishedNarrative / getDependenciesByNarrative / getRisksByNarrative — uses getServerSupabase
        ├── mutations.ts            create/update/delete + atomic reorder for phases / workstreams / dependencies / risks — uses getServerSupabase (authenticated)
        ├── derived.ts              loadIssuesForNarrative + computeDerived (per-WS / per-phase / global)
        ├── seed.ts                 Dev-only idempotent seeder; inline service client (no server-only chain)
        └── index.ts                Public re-exports (excludes seed)

scripts/
└── seed-narrative.ts               pnpm seed:narrative entrypoint

supabase/
├── config.toml
└── migrations/
    ├── 20260501113500_init_jira_dashboard_schema.sql
    ├── 20260501174714_add_project_dashboard_function.sql
    ├── 20260502174819_add_start_date_to_issues.sql
    ├── 20260504184656_add_narratives_schema.sql
    ├── 20260504234120_add_narrative_dependencies.sql
    ├── 20260505004354_add_project_stats_view.sql
    ├── 20260505015746_add_narrative_risks.sql
    ├── 20260505020350_fix_narrative_risks_array_check.sql
    ├── 20260505145650_add_user_profiles_and_grant_rpc_to_authenticated.sql   (iter 4f Migration A)
    ├── 20260505192722_add_authenticated_read_to_jira_tables.sql              (iter 4f hotfix)
    └── 20260505195313_tighten_narratives_rls_to_authenticated.sql            (iter 4f Migration B)
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

### Narratives module (`src/lib/narratives/`)

The data layer for `/projects/[key]/narrative` (UI in iter 4b). Reads
go through the **anon client** (RLS is read-open, no point pulling in
service-role for them); writes go through `getServiceSupabase()` so all
write paths cluster behind a single guard that future per-user RLS will
swap into.

- `getNarrativeById(id)` runs **four parallel queries** in a single
  `Promise.all`: the PostgREST embed (`project_narratives →
  narrative_phases → narrative_workstreams` via the phase_id FK), a
  separate fetch for orphan workstreams (`phase_id IS NULL`), one for
  `narrative_dependencies`, and one for `narrative_risks`. PostgREST
  can't filter an embedded resource by NULL on the join column, and a
  JSON-returning SQL function felt premature for a one-screen view —
  if this ever becomes hot, swap to RPC without changing the call
  signature.
- `reorderWorkstreams(narrativeId, ordering)` is **atomic via a single
  upsert**. supabase-js batches all rows into one PostgREST request
  which runs in a single transaction; we fetch existing rows first
  because PostgREST upsert replaces conflicting rows in full. Two
  pre-write checks: every id exists, every row already belongs to
  `narrativeId` — no accidental cross-narrative moves.
- **Seed** lives in `seed.ts` and is wired through `pnpm seed:narrative`.
  Idempotent: looks up `(project_id, title="Ticketing V2 - Demo Narrative")`
  and returns the existing row if found. The seed builds its own
  service-role client inline rather than reusing
  `getServiceSupabase()` — `service.ts` carries `import "server-only"`
  which intentionally throws under raw Node, and we don't want to
  weaken that guard just to share helpers with a dev script.
  `server-only` is installed as a devDep so `tsx` can resolve the
  package on app modules that import it (Next bundles its own copy).
- **Workstream `jira_issue_keys`** is a `TEXT[]` (NOT a FK to
  `issues`). The narrative is a presentation layer; it should not
  break when issues are renamed or removed. Live operational state
  (status, progress, dates) is read from `issues` at render time — by
  key match. The GIN index makes "which workstreams reference this
  issue?" queries fast as the narrative count grows.

### Narrative editor (`/projects/[key]/narratives` + `[id]/edit`)

#### Routes & Server Actions

- `/projects/[key]/narratives` — Server Component list page; each card
  is a Client Component for its 3-dot menu and confirm-delete modal.
- `/projects/[key]/narratives/[id]/edit` — Server Component loads the
  full narrative (`getNarrativeById`) and hands the tree to a Client
  shell. The route is desktop-first; a CSS-only `md:hidden` block
  shows "Editor disponible en pantallas más anchas" on small screens.
- `/projects/[key]/narratives/[id]/preview` — placeholder until 4c.
- All mutations live in `src/app/actions/narratives.ts` ("use server").
  `revalidatePath` fires only on actions whose result the list page
  needs to see (create / duplicate / delete / publish toggle); editor-
  side actions skip revalidation because the editor patches its tree
  in place from the returned entity.

#### Auto-save pattern (`useAutoSave` + flush-on-navigate)

The editor is the canonical reference for "lots of fields, debounced
save, navigation between sub-views" in this codebase.

- **Hook**: `useAutoSave(draft, saveFn, { debounceMs, onStateChange })`.
  Returns `{ state, errorMessage, lastSavedAt, flush, retry }`. State
  transitions: `idle → saving → saved` on success, `saving → error` on
  failure. `flush()` cancels any pending timer, awaits any in-flight
  save, then runs one final save synchronously if the draft diverged.
  `retry()` re-runs the last save (used by the indicator's
  "Reintentar" button on `state === 'error'`).
- **Form ergonomics**: each form (`NarrativeForm`, `PhaseForm`,
  `WorkstreamForm`) owns a draft `useState`, calls `useAutoSave` with
  it, and exposes `flush` + `retry` via `forwardRef` +
  `useImperativeHandle`. Forms are keyed by entity id at the parent so
  switching nodes remounts cleanly — no stale-prop merge puzzle.
- **Two selection paths from the shell**:
  - `onSelect: SelectedNode → void` — guarded; awaits `formRef.flush()`
    before swapping the panel. If flush fails the selection stays put
    so the user can fix the field.
  - `onForceSelect: SelectedNode → void` — bypasses flush. **Required**
    for post-delete navigation: the entity is gone, so a flushed save
    would 404 and trap the user on a phantom selection.
- **Equality**: shallow on top-level keys, with array element-equality
  so `jira_issue_keys` (TEXT[]) doesn't trip false positives.

#### Jira issue autocomplete

`JiraIssueKeysInput` queries from the **client** via `getAnonSupabase`
(not a Server Action) — debounce 200ms, limit 10, OR-filter on
`key.ilike` + `summary.ilike` scoped by `project_id`. RLS is read-open,
the data isn't sensitive, and skipping a Server Action keeps each
keystroke off the RSC payload path.

A **module-level `chipCache: Map<\`${projectId}:${issueKey}\`, IssueChipData | null>`**
hydrates chips for previously-seen keys without re-querying. `null`
means "we already looked; not in our sync" — surfaces the warning chip
without retrying. Cache survives unmounts but lives only for the
session. Search results also warm the cache opportunistically.

#### Editor limitations (TODOs)

- **No multi-edit concurrency.** Two users editing the same narrative
  will overwrite each other's last-write-wins. Spec assumed single
  editor at a time. When auth lands, add either pessimistic locking or
  per-field merge.
- **No permissions.** Anyone reaching the editor URL can write. RLS
  service-role passthrough means the auth gate is the only barrier;
  there is no auth gate yet.
- **No `beforeunload` guard.** Closing the tab while a save is pending
  loses up to 1.5s of typing. Tab navigation through Next `<Link>`
  doesn't flush either; only intra-editor selection changes do. Worth
  the simpler code for now.
- **`window.confirm` / `window.alert`** for phase/workstream delete and
  unpublish confirmations. The list page already uses HeroUI Modal for
  the narrative-level delete; phase/workstream deletes inside the
  editor stay native for keystroke ergonomics. Swap to Modal when the
  editor lands in customer-facing builds.

### Narrative public view (`/projects/[key]/narratives/[id]/preview`)

The shareable presentation surface — the page a PM links into a
deck or a customer email. Read-only; the editor is at `/edit`. No
nav chrome other than a subtle "Volver al editor" affordance and
the presentation-mode toggle.

#### Data loading

Server Component. Three things load on the page:

1. `getNarrativeById(id)` — the same composite read the editor uses.
2. `loadIssuesForNarrative(narrative)` — fetches the full
   parent → child closure of every key referenced by any workstream:
   one initial query by key, then up to `MAX_HIERARCHY_DEPTH` (4)
   passes that fetch issues whose `parent_id` is in the previous
   frontier, stopping early when a pass returns no new rows. Real
   Jira hierarchies max out at epic → story → task → sub-task (depth
   3); 4 leaves headroom. Total: 3–5 queries for typical narratives.

   Parent → child reconstruction uses an `id → key` Map built during
   loading (no PostgREST embed) — same pattern as `IssueDrawer`. By
   construction every parent we reference is already in the loaded
   set, so resolution is local.

   Returns `{ issuesByKey, childrenMap }`. `issuesByKey` covers the
   whole closure but the UI only looks up keys that a workstream
   listed; descendants don't reach `IssueChip`. `childrenMap`
   (`parentKey → ChildIssue[]`) drives the recursive progress pass.

3. `computeDerived(narrative, issuesByKey, childrenMap)` — pure
   computation; returns Maps keyed by workstream id and phase id for
   O(1) lookups in the renderer.

**Missing-from-sync issues do NOT count in the progress denominator.**
Their keys are tracked separately as `missingKeys` and surface as
"N sin sincronizar" + an amber `IssueChip` with `AlertTriangle`. We
don't know their status, so a Done ratio over them would be a lie.

#### Recursive progress (4c.1)

Each issue's progress is computed from the *whole* hierarchy under
it, not just its own status:

- **Leaf** (no loaded children): `100` if `status_category === 'Done'`,
  else `0`.
- **Non-leaf**: simple average of every loaded child's recursive
  progress.

A `visited` Set guards against cycles — Jira parent_id can't form one
in practice, but the guard turns an infinite loop into a
`console.warn` and a leaf treatment instead of a runtime crash.

**Workstream progress**: simple average of `computeIssueProgress` over
the directly-linked issues in `jira_issue_keys`. Missing keys excluded.

**Phase progress**: respects a non-null `progress_percent` override
(label "ajustado manualmente" surfaces on the bar). Otherwise the
simple average of its workstreams' progress.

**Global progress**: simple average of EVERY workstream's progress —
phases and orphan workstreams equally weighted, the phase is **NOT**
a unit of weighting. Worked example: a phase with workstreams
`[100, 50, 0]` plus one orphan workstream `[50]` gives
`(100 + 50 + 0 + 50) / 4 = 50%`.

**Counts vs. closure**: `byCategory`, `overdueCount`, `foundIssues`,
`missingKeys` only consider directly-linked issues — what the lay
reader put into the workstream and expects to see numbered. The
recursive closure exists only to drive `progress`. `totalIssues` in
the global header counts unique keys that are both vinculadas and
encontradas (no double-counting if a key appears in multiple
workstreams).

**Known under-estimation**: if an Epic was synced but its child
stories were not, the Epic appears as a leaf and reports `0` or
`100` based on its own status, masking the work below. Re-sync the
project (or widen `JIRA_PROJECT_KEYS`) to recover. Documented
trade-off — we only show what we have.

**TODO**: promote the recursive fetch to a `WITH RECURSIVE` SQL
function if the loop becomes a hot path or the closure routinely
exceeds ~500 rows. Today it's iterative-in-JS for legibility and
zero new migrations.

#### Issue type icons (4c.1)

`IssueChip` shows the issue type to the left of the key as an icon
+ tooltip. Mapping lives in
`components/narrative-public/issueTypeIcon.tsx`:

| Tipo (normalised) | Lucide icon       | Class           | Tooltip   |
|-------------------|-------------------|-----------------|-----------|
| `epic`            | `Zap`             | `text-purple-700` | "Épica"   |
| `story`           | `BookmarkPlus`    | `text-green-700`  | "Historia"|
| `task`            | `CheckSquare`     | `text-blue-700`   | "Tarea"   |
| `bug`             | `Bug`             | `text-red-700`    | "Bug"     |
| `subtask`         | `CornerDownRight` | `text-gray-500`   | "Subtarea"|
| anything else     | `Circle`          | `text-gray-400`   | "Otro"    |

The normaliser is case-insensitive and handles Spanish variants
("Épica", "Historia", "Tarea", "Subtarea") and dash-form quirks
("Sub-task" / "Subtask" / "Sub task"). Validate icon picks
visually in `/dev/components-preview` before swapping in the
canonical map.

#### Presentation mode (URL + data-attr cascade)

- **URL state**: `?mode=presentation` is parsed server-side so the
  initial render of a shared link matches what the sender saw.
- **Toggle**: `PresentationModeToggle` writes the param via
  `router.replace` (not push — the toggle shouldn't pollute history).
- **CSS cascade, not React state**: the outer wrapper sets
  `data-mode={mode}` and carries Tailwind's `group/preview` named
  group token. Every typography bump in descendants is expressed as
  `group-data-[mode=presentation]/preview:text-...`. Toggling the
  attribute is one DOM mutation — no re-render of the tree, no
  prop drilling.
- **ESC**: handler attached only while `mode === "presentation"` so
  it can't intercept Escape inside modals or popovers in normal mode.

#### Print stylesheet

`@media print` block in `globals.css`:
- `[data-print=hide]` disappears (toggle, "Volver al editor",
  every "Leer más" / "Ver detalles" / "Ver el por qué" button).
- `[data-collapsible]` forces `grid-template-rows: 1fr` so collapsed
  rationale and issue lists print expanded. The React state stays
  collapsed; the CSS just overrides for the print render.
- `break-after` on headings, `break-inside: avoid` on sections /
  articles to keep titles attached to their bodies across pages.

#### Limitations (4c)

- **Workstreams sin phase se renderizan después de todas las phases
  en orden por order_index. El schema actual no soporta interleave
  (workstream transversal entre phases). Cuando se agregue
  drag-and-drop en 4d, evaluar refactor a tabla unificada
  `narrative_items` o fractional order_index para soportar
  interleave real.**
- **No tokenized public link.** `/preview` is reachable by anyone
  who knows the narrative id. Tokenized share links land in a
  later iteration alongside auth.
- **No PDF export.** Print stylesheet is the export channel today.
  Real PDF (with header / footer / page numbers) is a feature for
  a commercial milestone.
- **`prefers-reduced-motion`** is respected per-transition via
  Tailwind's `motion-reduce:transition-none`, not via a global kill
  switch. Granular by design — if a future motion gets added we
  flag it explicitly.

### Narrative dependencies (`narrative_dependencies`, iter 4d)

Cross-team commitments declared inside a narrative — distinct from
`issue_links` (which model technical Jira relationships). A
dependency carries title, free-text PoD, optional Jira project key,
provider issue keys, two independent dates, manual
`commitment_status`, and coordination notes.

#### Schema decisions

- **`workstream_id` is nullable + ON DELETE SET NULL.** A dependency
  can apply to a single workstream or to the whole narrative
  (`null` = "Toda la narrativa"). On workstream delete we keep the
  dependency record because it represents a multi-team negotiation
  that outlives a workstream rename.
- **No composite FK `(workstream_id, narrative_id)`.** The "is this
  workstream really in this narrative?" check is enforced by the
  editor UI: the Select only surfaces the current narrative's
  workstreams. The risk of a cross-narrative pointer is low and
  contained to programmatic mis-calls; the cost of adding a
  `UNIQUE(id, narrative_id)` index on `narrative_workstreams` plus
  a composite FK is not justified for this case. (Phases / orphan
  workstreams use composite FK because they're the original
  load-bearing structural relationship.)
- **PoD is free text + optional Jira project key, no FK to
  `projects(key)`.** The PM may reference a team whose Jira project
  isn't synced (or never will be). The autocomplete *suggests*
  matches against `projects`, but free typing is always allowed.
- **No `CHECK` between `needed_by_date` and
  `expected_delivery_date`.** When `expected > needed` the gap IS
  the executive signal we want to surface. A constraint that
  rejects "late" data would force the PM to lie or omit fields.
- **`commitment_status` is manual.** Curated by the PM, never
  auto-derived from Jira state. The PM is the source of truth on
  whether a verbal "yes we'll do it" actually holds.

#### Risk level rules

`deriveRiskLevel({ delayRiskDays, commitmentStatus })` is a pure
function in `lib/narratives/derived.ts`. Precedence top to bottom —
first match wins:

| # | Condition                                                                       | Level      |
| - | ------------------------------------------------------------------------------- | ---------- |
| 1 | `commitmentStatus === 'blocked'`                                                | `critical` |
| 2 | `delayRiskDays > 14` AND status ∈ {`at_risk`, `proposed`}                       | `critical` |
| 3 | `delayRiskDays > 7` OR `commitmentStatus === 'at_risk'`                          | `high`     |
| 4 | `0 < delayRiskDays <= 7` OR `commitmentStatus === 'proposed'`                   | `medium`   |
| 5 | otherwise                                                                       | `low`      |

When `delayRiskDays` is `null` (one or both dates missing), the
date-based clauses fall through and status alone drives the level:
`blocked → critical`, `at_risk → high`, `proposed → medium`,
`agreed | confirmed → low`.

To tune the thresholds: edit `deriveRiskLevel` directly. The
function takes a single shape so callers don't need to update
signatures.

#### `expected_delivery_date` fallback

If the PM left the field blank, `computeDependencyDerived` falls
back to `MAX(due_date)` over the *found* provider issues (skipping
`null` due_dates). The card surfaces the difference visually
("(estimado por issues)" sublabel) so the reader knows the date
isn't a hard commitment from the provider.

If no provider issues are loaded, or none have a due date, the
expected stays `null` and `DateGapIndicator` falls to its neutral
"Necesario antes del…" mode.

#### Editor sidebar — always visible

The "Dependencias" group node always renders in the sidebar, even
with zero deps, because the PM needs an entry point to add one. The
same is NOT true for the public preview, which omits the section
entirely on zero deps.

### Narrative risks (`narrative_risks`, iter 4e)

PM-curated risks declared at the narrative level. Distinct from the
**derived** dependency `RiskLevel` (low/medium/high/critical) — risk
*severity* here is a 3-bucket curated input (low/medium/high), and
the card shape is impacts + mitigations bullets, not dates and
status.

#### Schema decisions

- **`impacts` and `mitigations` use `cardinality(arr) >= 1`** CHECK,
  not `array_length`. See "array_length vs cardinality" in the
  Database section above. The DEFAULT is `'{}'` so an INSERT that
  doesn't override fails the CHECK by construction — callers must
  provide at least one element. The UI seeds with a placeholder
  bullet.
- **`related_dependency_ids UUID[]`, no FK on array elements.**
  Postgres can't FK array elements; we filter dangling refs
  (deleted deps) at render time in `RiskCard`. GIN index keeps
  "which risks reference dep X?" lookups fast — same role as the
  GIN on `narrative_dependencies.provider_jira_issue_keys`.
- **No `workstream_id`.** A risk is always at narrative level. If a
  future requirement scopes risks per workstream, model it then —
  not preemptively.
- **`severity` is curated by the PM.** Never auto-derived. The PM
  is the source of truth on how seriously to weight the risk.

#### Editor — Risks group

Mirrors the Dependencies group: always visible (PM needs an entry
point), CRUD + reorder via dropdown, identifier shown next to title.
`RiskForm` uses `BulletListInput` for impacts and mitigations —
trim+filter at save time, surfaces "Mínimo un … no vacío." inline if
the array would empty out. Related dependencies render as toggle
chips (no autocomplete: deps per narrative are bounded). Auto-save
is the same `useAutoSave` hook used everywhere else.

#### Public — risks↔deps cross-link

`RiskCard` footer renders chips for related deps (anchor `#dep-{id}`).
`DependencyCard` reciprocates with a "Mencionada por" footer of risk
chips (anchor `#risk-{id}`). The two-way link lets a reader jump
from "this dep is fragile" to "what does this break" and back. Both
sections hide when their respective relationship lists are empty —
unrelated cards stay clean.

`RisksSection` is omitted entirely on zero risks (same pattern as
`DependenciesSection` — absence is the information). Subtitle
(`risks_section_subtitle`) renders under the heading when present.

### Authentication (iter 4f)

Google OAuth via Supabase Auth, restricted to `@veevart.com`. Two
gates run on first login (cached after) — domain whitelist + Jira
user verification. The whole product sits behind middleware; only
`/login`, `/auth/callback`, and the secret-gated sync endpoints are
public.

#### Three Supabase clients

| Client | Role | When |
| ------ | ---- | ---- |
| `getServerSupabase()` (`src/lib/supabase/server.ts`) | `authenticated` | Default. Server Components, Server Actions, middleware. Async (cookies are per-request). Used by `queries.ts` reads and `mutations.ts` writes — RLS gates them. |
| `getServerSupabaseAdmin()` (`src/lib/supabase/service.ts`) | `service_role` | Sync (`src/lib/sync/*`), seed, CLI scripts. Bypasses RLS by design. **Never** call from a request that has a user — use `getServerSupabase()` so writes carry actor identity. |
| `getAnonSupabase()` (`src/lib/supabase/anon.ts`) | `anon` | Browser-side public reads only. Today: `JiraIssueKeysInput` and `PodAutocompleteInput` autocomplete against `issues` / `projects`. Anything user-specific must use the server client. |

The Supabase / `@supabase/ssr` cookie wiring matters: `setAll` is
wrapped in `try/catch` in `server.ts` because Server Components have
a read-only cookie store and the docs explicitly guide swallowing
that exception there. The middleware does the actual cookie refresh
(see `src/middleware.ts`).

#### Login flow

1. `/login` (`LoginButton` Client Component) calls
   `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '${origin}/auth/callback' } })`.
2. Supabase redirects to Google → user approves → Google redirects
   back to Supabase → Supabase redirects to our `/auth/callback?code=...`.
3. The route handler at `src/app/auth/callback/route.ts`:
   - `exchangeCodeForSession(code)` — sets cookies, creates the
     `auth.users` row, fires the `on_auth_user_created` trigger that
     inserts into `user_profiles`.
   - **Gate 1 (domain)**: `isAllowedDomain` reads
     `ALLOWED_EMAIL_DOMAINS` and **fails closed** if unset/empty.
     Mismatch → `signOut()` + redirect to `/login?error=domain`.
   - **Gate 2 (Jira)**: skip if `user_profiles.jira_account_id` is
     already populated (cache hit from a prior login). Otherwise
     `verifyUserInJira(email)` calls `/rest/api/3/user/search` with
     a 5-second `AbortSignal.timeout`, requires an exact email match
     plus `accountId`, and is fail-closed (any timeout, 5xx, missing
     `emailAddress` → null → reject login).
   - On success: `update user_profiles set jira_account_id, jira_verified_at`
     (NOT upsert — there's no INSERT policy by design, the trigger
     handles inserts via SECURITY DEFINER bypass) and redirect to
     `/projects`. Cache write failures are logged, non-fatal.

#### Middleware

`src/middleware.ts` runs on every non-asset path. Two responsibilities:

1. **Refresh the Supabase session via `getUser()`**. The Supabase Auth
   server validates and writes refreshed cookies via the `setAll`
   hook. **Never** swap to `getSession()` — that reads cookies locally
   and a tampered cookie would falsely pass.
2. **Redirect** unauthenticated users to `/login`, and authenticated
   users away from `/login` (back to `/projects`).

Public allowlist: `/login`, `/auth/callback*`, `/api/sync*`,
`/api/cron/*`. Static assets are excluded via the matcher.
`preserveCookies` copies the refreshed-session cookies onto the
redirect response so the browser stores the new tokens immediately —
without it, the next request comes in with stale cookies and we
re-do the refresh.

#### Actor stamping

`getActor()` (`src/lib/auth/get-actor.ts`) pulls the user from the
session and returns `{ id, email }`. Server Actions that touch
tables with `created_by` / `updated_by` (`project_narratives`,
`narrative_dependencies`, `narrative_risks`) stamp `actor.email` on
creates and updates. `phases` and `workstreams` don't have those
columns and don't go through `getActor`.

`duplicateNarrative(sourceId, actorEmail)` writes the duplicator's
email on the new copy (NOT `source.created_by`) — a duplicate is a
new record with new ownership.

`publishNarrative` was inlined into `publishNarrativeAction` (calls
`updateNarrative` directly) so the publish toggle gets the same
actor-stamping path as any other update.

System-context paths (sync, seed, CLI scripts) keep
`created_by: 'system'` explicitly. The UI helper `formatActor` in
`src/lib/format/actor.ts` renders `null` / `''` / `"system"` as
**"Sistema"** so legacy rows from before iter 4f stay readable.

#### user_profiles table + RLS

`user_profiles` (UUID PK = `auth.users(id)` ON DELETE CASCADE,
unique `email`, `display_name`, `jira_account_id`, `jira_verified_at`).
Auto-populated via the `on_auth_user_created` trigger
(SECURITY DEFINER + pinned `search_path`). RLS: `user_profiles_self_read`
+ `user_profiles_self_update` only — INSERT goes through the
trigger's bypass, DELETE via `service_role` or cascade.

Narrative tables RLS (after Migration B):
- `auth_all FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE)`
  on the five tables (`project_narratives`, `narrative_phases`,
  `narrative_workstreams`, `narrative_dependencies`, `narrative_risks`).
- `service_role` bypasses RLS by design — sync and scripts unaffected.
- The previous `anon_read` policies are gone.

Jira tables (`projects`, `issues`, `issue_links`, `sync_runs`) and the
`project_stats` view keep their original `anon` SELECT policy AND a
parallel `authenticated` SELECT policy (added by the iter 4f hotfix
migration). Browser-side autocompletes still need anon, server-side
queries via the user session need authenticated.

#### TODOs (post-4f)

- **Per-project membership**: today every authenticated user can read
  and write every narrative. When membership lands, replace
  `USING (TRUE)` with a join against a `project_members` table.
- **Re-verification cadence**: `jira_verified_at` is recorded but
  never re-checked. If a user is removed from Jira, they can keep
  logging in until their Supabase session expires. A periodic cron
  that nulls `jira_account_id` after N days would force re-verification.
- **`email` as the actor key**: `created_by` / `updated_by` are TEXT
  with the user's email today. If email changes (or soft-delete is
  needed), migrate to `user_id UUID REFERENCES user_profiles(id)`
  and join for display. Comment in `formatActor.ts` flags this.

### Query waves (pattern)

Reusable shape for any page that loads N round-trips with mixed
dependencies. Used by `/projects/[key]/narratives/[id]/preview`
today; document new heavy reads here as we build them.

> **Wave 1**: data principal (e.g. the narrative).
> **Wave 2**: data dependiente paralela (cosas que necesitan IDs
> que aparecen en wave 1, pero que pueden cargarse en paralelo
> entre sí — e.g. `dependencies` y `project lookup` ambos sobre
> `narrative.id` / URL key).
> **Wave 3**: data derivada (e.g. el closure de issues, que
> necesita los keys de wave 1 + wave 2).

Each wave is a `Promise.all`; consecutive waves are awaited in
sequence. The benefit over a flat `Promise.all` is the dependency
edges are explicit in the code, and the benefit over fully
sequential awaits is each wave parallelises everything that *can*
run in parallel.

Apply this pattern when:
- A page needs three or more queries.
- Some queries depend on results from earlier queries.
- The natural shape would be either "all sequential" (slow) or
  "fold into one SQL function" (over-engineered).

Don't apply when:
- The page only has one or two queries — a single `Promise.all`
  or a sequential pair is clearer.
- Dependency edges are flat (everything can run together).

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

### `/projects` list view

- **`project_stats` SQL view** (in
  `20260505004354_add_project_stats_view.sql`, granted to `anon` +
  `authenticated`): one row per project with `total_issues` and
  `done_issues` aggregated server-side. The list page reads from it
  directly. Replaced an in-app group-by over a single `IN()` query
  that broke once total issues across projects went past PostgREST's
  default 1000-row response cap — projects at the alphabetical tail
  silently showed zero issues on the card while the per-project
  detail (which uses the `project_dashboard` RPC) was correct.
- **`security_invoker = true`** on the view: it executes with the
  caller's privileges and respects the underlying tables' RLS. When
  RLS tightens, the view follows automatically.
- If we ever need overdue / blocked counts on the list page, extend
  the view rather than re-introducing client-side grouping.

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
- `src/lib/jira/*`, `src/lib/sync/*`, `src/lib/supabase/service.ts`, `src/lib/supabase/server.ts`, `src/lib/auth/*`, `src/lib/narratives/queries.ts`, `src/lib/narratives/mutations.ts` import `"server-only"`. Guards the Jira API token and the Supabase service-role key from accidental client bundling. **Exception:** `src/lib/narratives/seed.ts` does NOT import `server-only` and instantiates its own service-role client — `pnpm seed:narrative` runs under raw Node via `tsx`, where `server-only` throws by design. The seed's safety comes from the script entrypoint (only invoked manually) and the dev-only intent of the data it inserts.
- `/api/sync` is the HTTP entry point (gated by `SYNC_SECRET`) for external callers (ops, future cron). The dashboard's "Resincronizar" button uses a Server Action (`triggerSync`) that calls `runSync()` directly — no `SYNC_SECRET` exposed to the browser.

### Database

Schemas spread across the `supabase/migrations/` timeline. Tables:

**Jira sync (init migration `20260501113500_init_jira_dashboard_schema.sql`)**

- `projects` — PK = Jira project id (TEXT), unique `key`, lead, `raw` jsonb, `last_synced_at`.
- `issues` — PK = Jira issue id (TEXT), unique `key`, `project_id` FK CASCADE, `status_category` CHECK ('To Do' | 'In Progress' | 'Done'), `parent_id` self-FK SET NULL, `due_date`, `start_date`, jira+local timestamps, `raw` jsonb.
- `issue_links` — BIGINT identity PK, `source_issue_id` FK, `target_issue_id` nullable FK, `target_issue_key` NOT NULL, unique on `(source, target_key, link_type)`.
- `sync_runs` — `status` running/success/failed, `sync_type` full/incremental, `project_key` (NULL = all), stats counters, `jql_used`, `error_message`.

**Narratives (migration `20260504184656_add_narratives_schema.sql`, extended by 4d / 4e)**

- `project_narratives` — UUID PK, `project_id` TEXT FK CASCADE to `projects(id)`, `title`, `subtitle`, `overview`, `status_summary`, `risks_section_subtitle` (iter 4e — optional sub-heading for the public risks section, NULL = heading only), `published` BOOL, `created_by` / `updated_by` placeholders (auth not yet). Multiple narratives per project allowed by design (board-version vs customer-version). **Counter columns** `next_risk_id INT NOT NULL DEFAULT 1` and `next_dependency_id INT NOT NULL DEFAULT 1` (iter 4e) back the identifier-claim RPCs and never decrease — see "Stable identifiers" below.
- `narrative_phases` — UUID PK, `narrative_id` FK CASCADE, `order_index`, `name`, `objective`, `rationale`, `status` CHECK ('completed' | 'in_progress' | 'upcoming' | 'at_risk'), `progress_percent` 0-100 nullable, `start_date <= end_date` CHECK. Composite `UNIQUE (id, narrative_id)` exists to back the workstream FK below.
- `narrative_workstreams` — UUID PK, `narrative_id` FK CASCADE, **`phase_id` nullable** + composite FK `(phase_id, narrative_id) → narrative_phases(id, narrative_id)` ON DELETE CASCADE. NULL `phase_id` = orphan workstream rendered at the narrative root, beside phases. `jira_issue_keys TEXT[]` indexed via GIN — references issues by key only, no FK (live data still comes from `issues`).
- `narrative_risks` (iter 4e) — UUID PK, `narrative_id` FK CASCADE, `identifier TEXT NOT NULL CHECK (identifier ~ '^R\d+$') UNIQUE per narrative, `title`, `description`, `severity` CHECK in (low / medium / high), `impacts TEXT[] NOT NULL DEFAULT '{}'`, `mitigations TEXT[] NOT NULL DEFAULT '{}'`, both with `cardinality(arr) >= 1` CHECK (see "array_length vs cardinality" below). `related_dependency_ids UUID[] NOT NULL DEFAULT '{}'` indexed via GIN — Postgres can't FK array elements, so dangling refs (after a dep delete) are filtered at render time. `order_index INT NOT NULL`.

**Auth (migration `20260505145650_add_user_profiles_and_grant_rpc_to_authenticated.sql`, iter 4f Migration A)**

- `user_profiles` — UUID PK = `auth.users(id)` ON DELETE CASCADE, unique `email`, `display_name`, `jira_account_id` (cached on first login), `jira_verified_at`. Auto-created via the `on_auth_user_created` trigger (`SECURITY DEFINER` + `SET search_path = public`). RLS: `user_profiles_self_read` + `user_profiles_self_update` only — INSERT goes through the trigger's bypass, DELETE via cascade.

`raw` jsonb policy: **never query from UI**. If a field becomes recurrent, extract it to a typed column in a follow-up migration.

RLS post-iter 4f:
- **Narrative tables (5)**: `auth_all FOR ALL TO authenticated USING(TRUE) WITH CHECK(TRUE)`. The previous `anon_read` policies were dropped in Migration B. `service_role` bypasses by design — sync, seed, scripts unaffected.
- **Jira tables (4)**: `anon` SELECT (original) AND `authenticated` SELECT (added by the iter 4f hotfix migration). Browser-side autocompletes still use anon; Server Components via the user session use authenticated. Mutations remain service-role only (sync).
- **`user_profiles`**: self-read + self-update for `authenticated` only.
- **TODO**: per-project membership. Today every authenticated user can read/write every narrative; replace `USING(TRUE)` with a join against a future `project_members` table when product needs it.

#### Stable per-narrative identifiers (iter 4e)

`narrative_dependencies` and `narrative_risks` carry `identifier TEXT` (`D1, D2, ...` and `R1, R2, ...` respectively) that is auto-assigned at insert time and **immutable** afterwards. Two RPCs back this:

- `claim_next_dependency_identifier(p_narrative_id UUID) RETURNS TEXT`
- `claim_next_risk_identifier(p_narrative_id UUID) RETURNS TEXT`

Each runs `UPDATE project_narratives SET next_*_id = next_*_id + 1 WHERE id = p_narrative_id RETURNING (next_*_id - 1)` and returns the previous value formatted with the right prefix. Concurrent calls serialize via the row-level lock the UPDATE takes — no race window. **Counters never decrease**, so a delete does NOT reuse identifiers — D5 stays D5 even if the original D5 was removed. Counters are NOT a count of live rows.

Why not `MAX(...) + 1` over live rows? Because deleting D5 and adding a new dep would re-issue D5, breaking the contract that an identifier in a meeting note or a screenshot keeps pointing at the same record forever.

`createDependency` / `createRisk` in `mutations.ts` call the RPC, then INSERT with the returned identifier. The corresponding `CreateDependencyInput` / `CreateRiskInput` types `Omit` `identifier` so callers can't fight the contract.

#### array_length vs cardinality (iter 4e postmortem)

The first cut of `narrative_risks` used `CHECK (array_length(impacts, 1) >= 1)`. Empty arrays slipped through. Reason: `array_length('{}', 1)` returns `NULL` (not 0), `NULL >= 1` is `NULL`, and **Postgres CHECK treats NULL as satisfied** — only `FALSE` violates. The fix-up migration (`20260505020350_fix_narrative_risks_array_check.sql`) replaces both checks with `cardinality(arr) >= 1` because `cardinality('{}')` returns `0`, so the comparison evaluates `FALSE` and the constraint correctly rejects.

**Rule**: never use `array_length(arr, 1)` inside a CHECK that's meant to enforce non-emptiness. Use `cardinality()`.

#### Composite FK vs trigger for cross-table consistency

When a row needs to point at a parent that itself belongs to a grandparent (here: a workstream's phase must belong to the workstream's narrative), there are two enforcement options.

| Pattern | When to choose |
| ------- | -------------- |
| **Composite FK** (`UNIQUE (id, parent_id)` on the parent table + `FK (child_parent_id, grandparent_id) → parent(id, grandparent_id)`) | Validation is structural — a value in row X must match a value in row Y. The optional case is naturally handled (MATCH SIMPLE skips checks when any FK column is NULL). No custom SQL function to maintain. CASCADE / SET NULL semantics are declarative. **Default to this.** |
| **BEFORE INSERT/UPDATE trigger** | Validation depends on data outside the FK graph (e.g. a value in a third unrelated table), needs a custom error message that compliance / customer support requires verbatim, or the rule changes per request context (tenant settings, feature flags). |

`narrative_workstreams` uses the composite FK pattern; the original trigger proposal in the iter 4a plan was downgraded once we noticed the rule was purely structural. The trade-off accepted: a `UNIQUE (id, narrative_id)` index that's redundant next to the PK, and a Postgres FK violation error message that's less didactic in Spanish than a custom RAISE EXCEPTION would have been. The cleanliness of "no plpgsql to maintain" won out.

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
- **Supabase clients (post-iter 4f)**:
  - `getServerSupabase()` (cookies-aware, authenticated session) is the **default** for app code — Server Components, Server Actions, middleware, narrative queries / mutations.
  - `getServerSupabaseAdmin()` (service-role bypass) only for sync, seed, CLI scripts — anything that runs outside a user request.
  - `getAnonSupabase()` only for browser-side public reads (autocompletes).
  - Never use the admin client from a request that has a user — use the server client so writes carry actor identity and respect RLS.
- **Errors surface explicitly.** Sync errors pass through `describeError()` (handles Supabase `PostgrestError`, which is NOT an Error instance) and persist on `sync_runs.error_message`.
- **Credentials only via env vars.** Document every new one in `.env.example`. Never log the Authorization header, the Jira API token, or the Supabase service-role key — even on error paths.
- **Folders:** `src/app/` (routes), `src/lib/jira/`, `src/lib/supabase/`, `src/lib/sync/`, `src/lib/auth/`, `src/lib/narratives/`, `src/lib/format/`, `src/components/`, `src/types/`.
- **`raw` jsonb columns are not for UI consumption.** If you find yourself reading a recurrent field from `raw`, promote it to a typed column in a new migration.

## Known tech debt

- **Issue deletion is not detected.** Jira doesn't expose a "what was deleted since X" endpoint cheaply. When it matters: periodic full sync that lists all current ids and diffs.
- **Watermark uses a 1-day buffer (date-only)** to dodge JQL TZ ambiguity. Refine to a TZ-aware timestamp (using the token user's `/myself.timeZone`) when volume justifies it.
- **Stuck `running` rows in `sync_runs`.** When the dev server restarts (HMR, file save) mid-sync, the `runSync` `try/catch` never fires and the row stays `running` forever. Run `pnpm diag:runs:reap` to mark rows older than 5min as `failed`. Long-term fix: a periodic reaper or a NOTIFY-based heartbeat. Acceptable today as a manual recovery step.
- **`/projects/[key]` issues table is not virtualized.** Fine for the current scale (NOXSCRUM has ~813 issues, render is snappy). At ~2000+ rows, switch to a virtualized renderer or paginate server-side. The bucketize/filter passes are O(n); the cost is in the DOM.
- **`/projects/[key]` roadmap is not virtualized.** Designed for ~10x current scale (~270 epics). The chart renders one absolutely-positioned `<button>` per visible epic plus a couple of SVG lines per week — at 270 epics × month-ranged ranges that's ~300 DOM nodes, fine. At 2000+ epics consider virtualizing the chart body rows (the left label column would virtualize in lockstep) and pre-bucketing on the server.
- **Drawer link enrichment runs a second `in()` query** to fetch summary/status for linked targets. At ~10s of links per issue this is fine; consider a single SQL function with JOINs if drawers feel slow.
- **No tests, no CI yet.**
- **No realtime updates** — the page is a static-ish render until reload or a click on Resincronizar.

## Dev tools

- **`/dev/components-preview`** — permanent visual bench for
  components, accessible only by typing the URL (not linked from
  production navigation). Server Component, statically rendered, zero
  runtime cost when not visited. Add new sections here as new
  components or variants need visual validation. Today the page
  carries the Issue Chips canonical map plus the alt-icon variants we
  considered for Epic and Story before locking 4c.1.

## Out of scope (do NOT add without asking)

Per-user roles or permissions (every authenticated user has the same rights today), email/password fallback, magic links, 2FA, custom recovery flows, multi-tenancy, public sharing without login, cron jobs, Inngest / Trigger.dev, Recharts, React Flow, TanStack Table, **Gantt libraries** (gantt-task-react, frappe-gantt, etc. — the roadmap is intentionally hand-rolled SVG + HTML), alternative auth libraries (NextAuth, Clerk, Auth.js — Supabase Auth alcanza), new routes beyond the ones listed in Architecture, any library outside the locked stack.
