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

**Iteration 4f:** Google OAuth via Supabase Auth, restricted to `@veevart.com` (whitelist via `ALLOWED_EMAIL_DOMAINS`) with a per-user check against Jira's user search. New `user_profiles` table mirrors `auth.users` and caches the resolved Jira `accountId` so subsequent logins skip the API hit. `/login` + `/auth/callback` route handler enforce the two gates; failed gates sign the user out and redirect to `/login?error=domain|jira|unknown`. New middleware refreshes the Supabase session via `getUser()` (validated against the auth server, never `getSession()` which trusts cookies) and gates every path except `/login`, `/auth/callback`, `/api/sync`, `/api/cron/*`. Three Supabase clients now: `getServerSupabase` (cookies-aware, default for app reads/writes via authenticated session), `getServerSupabaseAdmin` (service-role bypass for sync, seed, scripts), `getAnonSupabase` (browser-side public reads in autocompletes). RLS tightened: narrative tables drop `anon_read` and gain `auth_all` on `authenticated`; Jira tables (`projects`, `issues`, `issue_links`, `sync_runs`) get a parallel `authenticated` SELECT policy alongside the existing `anon` one. `created_by` / `updated_by` get stamped with the actor's email by Server Actions (`getActor` helper); the new `formatActor` helper renders `null` / `"system"` as **"Sistema"** in the UI. UserMenu (avatar + Dropdown with email + logout) sits in every primary header except `/preview`.

**Iteration 4g:** Narrative access integrated into the main project flows. The `project_stats` view gains a `narratives_count` column (computed via a derived LEFT JOIN over `project_narratives` so the issue COUNT stays a simple aggregate; `COALESCE(..., 0)` so zero-narrative projects return 0 instead of NULL). Each `ProjectCard` on `/projects` shows a "N narrativas" chip top-right when count > 0, using the **stretched-link + group-hover pattern**: a wrapping `<div className="group relative">` carries the hover state, the primary `<Link>` becomes an `absolute inset-0` overlay with a sr-only label, and the badge is a second `<Link relative z-10>` rendered after the overlay so it wins the hit-test. `/projects/[key]` gains a third tab "Narrativas" embedding `NarrativesListPanel` (the same Server Component the standalone page uses); `ViewKey` extends to `"list" | "roadmap" | "narratives"` with an `isViewKey` type guard. The standalone `/projects/[key]/narratives` URL becomes a `permanentRedirect` (308) to `/projects/[key]?view=narratives` — no validation, an invalid key still 404s one hop later. `/projects` switches from the anon client to `getServerSupabase` so the dashboard read carries the user session (today equivalent under `auth_all USING(TRUE)`, but aligns with the iter 4f contract for when per-project membership lands). The four narrative Server Actions retarget `revalidatePath` to `/projects/[key]` (the new home of the list).

**Iteration 4h Round 1:** Product is now called **Prism** — login heading, root metadata, topbar logo, every internal surface. First commit of a multi-round design-system pass after stakeholder feedback ("se ve como un esqueleto"). Round 1 lands the foundation and applies it to one screen (`/projects`); other screens still render with raw HeroUI surfaces and inherit only the new global tokens — accepted visual cost during rollout. Six commits scoped to: (1) OKLCH palette + radius/shadow tokens in `globals.css` `@theme` + Geist Sans/Mono via the `geist` package; (2) UI primitives in `src/components/ui/` (`Card`, `Button`, `Chip`, `ActionButton`, `CurvedLines`) built on `tailwind-variants`; (3) decorative `CurvedLines` SVG (single family this round); (4) persistent topbar in a new `(app)/` route group — `Topbar` Server Component + `TopbarNav` (Client, usePathname active state) + `TopbarMobileMenu` (Client, HeroUI Drawer hamburger); UserMenu migrates from per-page headers into the topbar (one `getCurrentUser()` per request at the layout boundary). `/projects/[key]/narratives/[id]/preview` stays at `app/projects/...` outside `(app)/` so it inherits no topbar — preserves the chrome-free shareable read. (5) `/projects` redesigned: rounded warm-cream hero with `CurvedLines` + RefreshCw `SyncButton`; new `ProjectCard` (lead-initial avatar, mono key, divider, two big stats, narratives chip + decorative `ActionButton`); `Card variant="hero"` empty state with `FolderOpen`. The override of HeroUI v3's `--color-text-muted` / `--color-foreground` / `--color-surface` tokens by our `@theme` block is intentional: one product-wide palette across HeroUI components and our own primitives.

**Iteration 4h Round 2:** Prism applied end-to-end on `/projects/[key]`. Six commits + a couple of polish follow-ups: (1) `KpiHeader` rebuilt on the Card primitive — text-4xl page title, mono key, Clock-icon last-sync; KPI numbers bumped to text-4xl bold; functional colors switch to Prism tokens (`text-error/warning/success`); progress bar segments to `bg-cool-200/bg-info/bg-success`. (2) `ProjectViews` swaps HeroUI `Tabs` for a custom underline-style `<button role="tab">` strip — active tab gets a 2px `border-primary-500` underline, ARIA Tabs pattern with arrow / Home / End keyboard nav, conditional panel render (active only). (3) Lista view: `ProjectTable` wrapped in a Card primitive (`p-0 overflow-hidden`); type icon to the left of every key (Epic ⚡ primary-600 / Story BookmarkPlus success / Task CheckSquare info / Bug Bug error) via the new `components/project/issueTypeIcon.tsx` helper; rows hover `bg-warm-50`; `StatusChip` migrates onto the `Chip` primitive; `AssigneeCell` drops HeroUI Avatar for a hand-rolled lavender circle (matches ProjectCard); `DueDateCell` colors → Prism functional; HeroUI Switch → new `Toggle` primitive at `src/components/ui/Toggle.tsx` (lavender on / cool-grey off, role="switch"). (4) Roadmap view: bar palette → Prism functional (`bg-error` overdue, `bg-info-bg` + `bg-info` overlay in-progress, `bg-cool-200` future, `bg-success-bg` done); chart wrapped in Card primitive; "Hoy" line `bg-error`; `UnplannedCard` becomes a borderless rounded-2xl with hover-shadow lift; HeroUI `<input type="date">` pickers → HeroUI `DateRangePicker` compound (CalendarDate + `parseDate(iso)` + `value.toString()`); range presets and "Aplicar" use the Prism `Button` primitive; "Mostrar completadas" Switch → shared `Toggle`. (5) Narratives tab coherence: `NarrativeCard` migrates onto the Prism Card primitive (same shape as ProjectCard); Publicada / Borrador raw badges → `Chip` variants (status-done / status-todo); preview link repainted as pill matching `Button variant="secondary"`; `NewNarrativeButton` trigger → Prism `Button`. HeroUI `Modal` and `Dropdown` compounds keep HeroUI Buttons inside (short-lived modal-only chrome — re-aliased as `HeroButton`). `@internationalized/date` added as a direct dep so the `DateRangePicker` contract is stable across HeroUI bumps.

**Iteration 4h Round 3 (current):** Prism applied end-to-end on the narrative editor (`/projects/[key]/narratives/[id]/edit`). Seven commits, no functionality changes: (1) `EditorHeader` — Prism breadcrumb + Vista-previa pill secondary + Publicar Prism Button primary; `AutosaveIndicator` migrated to functional palette (`text-success` saved / `text-error` saved-with-error / `text-text-secondary` saving) and the retry trigger uses Prism Button variant=ghost. (2) `StructureSidebar` — type icons per node (`BookText` / `Layers` / `GitBranch` / `Link2` / `AlertTriangle`, all neutral text-text-secondary so they don't compete with Jira-issue-type icons elsewhere); floating-right status / severity dots on Phase and Risk rows (4 colors per status, 3 per severity); `selectableRowClasses` rewritten with `border-l-2 border-l-primary-500 bg-primary-100 text-primary-900 font-medium` for the active state and a transparent border-l in idle so geometry stays constant across selections; "+ Agregar X" bottom CTAs as ghost-primary. (3) Forms — new shared `form-fields.tsx` with `Field` / `TextInput` / `Textarea` / `SectionHeading` / `FormDeleteButton` / `DateInputField`; the 5 edit forms (Narrative / Phase / Workstream / Dependency / Risk) and the 2 list panels (Dependencies / Risks) all flow through these primitives. Textareas drop `font-mono` (Geist Sans default takes over) so prose reads as prose; identifiers (R1, D1, NOX-123) ride `GeistMono.className`. Native `<input type="date">` in PhaseForm and DependencyForm migrated to HeroUI `DatePicker` via `DateInputField` — closes the date-input gap left after R2. (4) `BulletListInput` — colored dots replace numeric bullets via a new `tone` prop (RiskForm passes `tone="danger"` for impacts and `tone="success"` for mitigations); shared `TextInput` chrome; ghost-primary "+ Agregar item". No reorder buttons added (the up/down spec mockup was a feature change, deferred). (5) Autocompletes — `JiraIssueKeysInput` and `PodAutocompleteInput` get rounded-xl shadow-lg dropdowns with `hover:bg-primary-50` / `focus-visible:bg-primary-100` rows; chips repainted (lavender for found, warm-100 hydrating, warning-bg + AlertTriangle for missing-from-sync). (6) New `empty-states/EmptyNarrativeState.tsx` — Card hero rendered BELOW NarrativeForm (not in place of it) when the narrative root is selected and the tree has zero structure; two CTAs powered by `addPhase` / `addOrphanWorkstream` lifted to EditorShell. Mobile fallback (`md:hidden`) repainted as a Card hero with Monitor icon. NarrativeCard's delete confirmation modal gains an AlertTriangle icon in an error-bg circle. The sidebar's `window.confirm` delete prompts stay native — replacing them would have been a new state machine, out of R3 polish scope.

## Stack

- Next.js 16 (App Router) + TypeScript
- React 19, Turbopack
- HeroUI v3 (`@heroui/react`, `@heroui/styles`, `tailwind-variants`)
- Tailwind CSS v4 (CSS-first config, `@tailwindcss/postcss` plugin)
- `geist` (Vercel-canonical Geist Sans / Mono) — installed iter 4h R1, replaces the Next.js Google Fonts Geist that was scaffolded
- `@internationalized/date` — direct dep since iter 4h R2 (powers HeroUI's DatePicker / DateRangePicker)
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
├── middleware.ts                    (iter 4f) Auth gate. Refreshes session via getUser; redirects unauth → /login
├── app/
│   ├── layout.tsx                  (iter 4h R1) Root html/body + GeistSans.className + GeistMono.variable + Prism metadata
│   ├── globals.css                 @import "tailwindcss"; @import "@heroui/styles"; @theme { ...Prism tokens... }
│   ├── api/sync/route.ts           POST /api/sync (x-sync-secret guard) — outside (app), no topbar
│   ├── login/
│   │   ├── page.tsx                Server: card with error banner + LoginButton — outside (app), no topbar
│   │   └── LoginButton.tsx         Client: signInWithOAuth via createBrowserClient
│   ├── auth/callback/route.ts      Code exchange + domain check + Jira verify + cache — outside (app), no topbar
│   ├── projects/[key]/narratives/[id]/preview/page.tsx
│   │                               (iter 4c) Public shareable narrative — DELIBERATELY outside the (app) group so it inherits NO topbar. Different leaf URL than (app)/projects/[key]/..., so no filesystem conflict on the [key]/[id] segments.
│   └── (app)/                      (iter 4h R1) Route group for every authenticated surface that should render under the persistent Topbar. Adds layout.tsx that fetches getCurrentUser once and passes it to <Topbar>.
│       ├── layout.tsx              Server: getCurrentUser() + <Topbar user={...}>{children}</Topbar>
│       ├── page.tsx                Root smoke test (HeroUI button)
│       ├── dev/components-preview/ Permanent dev tool: visual bench for components (not linked from prod)
│       │   └── page.tsx
│       └── projects/
│           ├── page.tsx            (iter 4h R1) Hero with CurvedLines + grid of new ProjectCard. Reads project_stats incl. narratives_count via getServerSupabase.
│           ├── actions.ts          Server Action triggerSync()
│           ├── loading.tsx
│           ├── error.tsx
│           └── [key]/
│               ├── page.tsx        Server Component: project_dashboard RPC + issues query, parses ?view (list|roadmap|narratives), mounts NarrativesListPanel inside the tab (iter 4g)
│               ├── not-found.tsx   Custom 404 for unknown project keys
│               └── narratives/
│                   ├── page.tsx    (iter 4g) permanentRedirect (308) → /projects/[key]?view=narratives
│                   └── [id]/edit/page.tsx
│                                   Server Component: load narrative, hand off to EditorShell. UserMenu is now in the topbar — page does not fetch currentUser.
├── app/actions/
│   ├── auth.ts                     (NEW iter 4f) "use server" — logoutAction
│   └── narratives.ts               "use server" — every narrative mutation as a Server Action; resolves actor + stamps created_by/updated_by
├── components/
│   ├── SyncButton.tsx              (iter 4h R1) Client: built on the new Button primitive with a RefreshCw icon (animate-spin while pending). variant primary | secondary, size sm/md/lg.
│   ├── UserMenu.tsx                (iter 4f) Client: avatar trigger + Dropdown (email + Cerrar sesión). Mounted ONCE in the Topbar (iter 4h R1) — was previously per-page.
│   ├── Topbar.tsx                  (iter 4h R1) Server Component: brand "PRISM" + TopbarNav + UserMenu. max-w-7xl inner container so nav items align with the page-content column.
│   ├── TopbarNav.tsx               (iter 4h R1) Client: desktop nav items, usePathname for active state. "Settings" is a real <button disabled aria-disabled> with a "Próximamente" badge — not a fake <Link>.
│   ├── TopbarMobileMenu.tsx        (iter 4h R1) Client: hamburger button + HeroUI Drawer (controlled, same pattern as IssueDrawer). md:hidden.
│   ├── ui/                         (iter 4h R1) Prism design system primitives — see "Design system" section below.
│   │   ├── Card.tsx                tailwind-variants — variants default (rounded-2xl/shadow-md/p-6), hero (rounded-3xl/shadow-lg/p-8), compact (rounded-xl/shadow-sm/p-4). Sits next to HeroUI Card.
│   │   ├── Button.tsx              tailwind-variants — variants primary (lavender pill) / secondary (border pill) / ghost / circular (Aether-style black circle); sizes sm/md/lg with compoundVariants for circular fixed dimensions. Native onClick.
│   │   ├── Chip.tsx                tailwind-variants — variants status-todo|progress|done, severity-high|medium|low, accent (lavender), muted. Renders <span>; non-interactive by design.
│   │   ├── ActionButton.tsx        Opinionated icon-only Aether-style circle. Required aria-label at the type level. tabIndex={-1} + aria-hidden + pointer-events-none turns it decorative when wrapped by a stretched-link card.
│   │   ├── Toggle.tsx              (iter 4h R2) Switch primitive. <button role="switch" aria-checked> with styled track + thumb (lavender on / cool-grey off). Replaces HeroUI Switch on screens we redesign so the rendered chrome stays on-brand.
│   │   ├── Decorative.tsx          CurvedLines: 4 staggered cubic-Bezier paths in a 1200×400 viewBox. preserveAspectRatio="none" + vector-effect="non-scaling-stroke" for clean stroke at any container shape. stroke="currentColor" + opacity-[0.08] default.
│   │   └── index.ts                Barrel re-exports.
│   ├── projects/
│   │   └── ProjectCard.tsx         (iter 4h R1) Server: lead-initial avatar + truncated name + mono key + lead. Two-column stat block (Total issues / Completado), narratives Chip + decorative ActionButton in the footer. Stretched-link + group-hover pattern wraps the whole card; the chip's Link wins z-10 hit-test for ?view=narratives.
│   ├── narrative-list/
│   │   ├── NarrativesListPanel.tsx (iter 4g) Server Component: heading + list/empty + CTA. Reusable across the standalone redirect target and the /projects/[key]?view=narratives tab. projectName: string | null — null → "Narrativas del proyecto" (generic, when KpiHeader already shows the name); string → "Narrativas de <name>".
│   │   ├── NarrativeCard.tsx       Card + 3-dot menu (Duplicar / Eliminar) + draft / published badge
│   │   └── NewNarrativeButton.tsx  "Nueva narrativa" CTA + creation modal
│   ├── narrative-editor/
│   │   ├── EditorShell.tsx         Tree state + selection + flush-on-navigate guard. Bootstrapping addPhase / addOrphanWorkstream (iter 4h R3) for the empty state.
│   │   ├── StructureSidebar.tsx    Tree UI + create / delete / move / reorder. Iter 4h R3: type icons + floating status/severity dots + Prism row palette.
│   │   ├── ActiveFormPanel.tsx     Routes the right form to the right entity by selection; mounts EmptyNarrativeState below NarrativeForm when the tree has zero structure (iter 4h R3).
│   │   ├── form-fields.tsx         (iter 4h R3) Shared form primitives: Field, TextInput, Textarea, SectionHeading, FormDeleteButton, DateInputField (HeroUI DatePicker wrapper). All 5 edit forms flow through these so input chrome / labels / helper text / date pickers stay identical.
│   │   ├── empty-states/
│   │   │   └── EmptyNarrativeState.tsx  (iter 4h R3) Card-hero with Layers icon + 2 CTAs (Agregar primera fase / Workstream sin fase). Renders below NarrativeForm when tree.phases + orphan_workstreams are both empty.
│   │   ├── NarrativeForm.tsx       useAutoSave for title / subtitle / overview / status_summary / risks_section_subtitle. Iter 4h R3: textareas drop font-mono.
│   │   ├── PhaseForm.tsx           useAutoSave for name / objective / rationale / status / dates / progress. Iter 4h R3: HeroUI Select for status; HeroUI DatePicker (via DateInputField) for start/end.
│   │   ├── WorkstreamForm.tsx      useAutoSave for name / description / phase_id / jira_issue_keys.
│   │   ├── DependencyForm.tsx      useAutoSave for the full narrative_dependency record. Iter 4h R3: HeroUI DatePicker for needed_by / expected_delivery.
│   │   ├── DependenciesListPanel.tsx  Group panel: list of dependency cards + delete. Iter 4h R3: rounded-2xl border-border cards with hover-shadow.
│   │   ├── RiskForm.tsx            useAutoSave for the full narrative_risk record (BulletListInput x2 with tone="danger"/"success" + dep toggle chips). Iter 4h R3: identifier in GeistMono.
│   │   ├── RisksListPanel.tsx      Group panel: list of risk cards + delete. Iter 4h R3: identifier badge in GeistMono.
│   │   ├── BulletListInput.tsx     Reusable TEXT[] editor (rows + Enter-to-add + max ceiling, default 10). Iter 4h R3: tone prop drives the per-row dot color (danger / success / neutral).
│   │   ├── PodAutocompleteInput.tsx   Free-text PoD with autocomplete against `projects`. Iter 4h R3: rounded-xl shadow-lg dropdown, "→ KEY" pill in GeistMono.
│   │   ├── JiraIssueKeysInput.tsx  Anon-client autocomplete + module-level chip cache; optional `providerProjectKey` rescopes. Iter 4h R3: chips lavanda for found, warm-100 hydrating, warning-bg for missing-from-sync.
│   │   ├── AutosaveIndicator.tsx   Saving / Saved / Error states + Reintentar. Iter 4h R3: functional palette (text-secondary / text-success / text-error) + AlertCircle (was AlertTriangle, reserved for destructive surfaces now).
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
│       ├── KpiHeader.tsx           (iter 4h R2) Server Component, synchronous: breadcrumb + page title (text-4xl bold) + Clock-icon meta + 4 KPI cards on the Card primitive. Functional colors via Prism tokens (text-error/warning/success).
│       ├── ProjectViews.tsx        (iter 4h R2) Client: custom underline-style tab bar (drops HeroUI Tabs), URL state for ?view, ARIA Tabs pattern with arrow / Home / End keys. Accepts narrativesPanel: ReactNode for the third tab body.
│       ├── ProjectTable.tsx        (iter 4h R2) Client: filter Toggles + epic-grouped table inside a Card primitive (p-0 overflow-hidden). Type icon left of each key (via issueTypeIcon helper). Hover bg-warm-50. Owns drawer state.
│       ├── ProjectRoadmap.tsx      (iter 4h R2) Client: timeline + bars on Prism functional palette (bg-error / bg-info-bg + bg-info overlay / bg-cool-200 / bg-success-bg) + "Sin planificar" cards. Range picker via HeroUI DateRangePicker. Owns drawer state.
│       ├── IssueDrawer.tsx         Client: lazy-fetches parent / kids / sub-tasks / links
│       ├── StatusChip.tsx          (iter 4h R2) Migrates onto the Chip primitive (variants status-todo/progress/done). Plain — bundled to client by importers.
│       ├── AssigneeCell.tsx        (iter 4h R2) Hand-rolled lavender circle (bg-primary-100 + text-primary-700) — drops HeroUI Avatar.
│       ├── DueDateCell.tsx         (iter 4h R2) Functional colors: text-error font-medium overdue, text-warning ≤7d, text-text-primary future, text-text-muted done.
│       └── issueTypeIcon.tsx       (iter 4h R2) Project flavor of the type→icon helper. Distinct from narrative-public/issueTypeIcon.tsx so /preview (iter R4 territory) can refresh independently. Returns { Icon, colorClass, label } for Epic / Story / Task / Bug / Sub-task / fallback.
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
    ├── 20260505195313_tighten_narratives_rls_to_authenticated.sql            (iter 4f Migration B)
    └── 20260505213418_add_narratives_count_to_project_stats.sql              (iter 4g Migration C)
```

### Roadmap view (`?view=roadmap`)

`/projects/[key]` has three tabs — **Lista** (the issues table),
**Roadmap** (epics on a timeline), and **Narrativas** (the editable
narrative list, iter 4g). State lives entirely in URL query params:

| Param   | Values                          | Default                                |
| ------- | ------------------------------- | -------------------------------------- |
| `view`  | `list` (default) \| `roadmap` \| `narratives` | `list`                           |
| `from`  | `YYYY-MM-DD`                    | today (UTC)                            |
| `to`    | `YYYY-MM-DD`                    | today + 6 months (UTC)                 |

`from` / `to` are validated server-side; malformed or `from >= to` falls
back to the default. Range presets ("Este trimestre", "Próximos 6 meses",
"Próximo año", "Todo") write absolute dates to the URL — there is no
"preset code" persisted, so a shared link is a deterministic snapshot.
Manual range picker (HeroUI `DateRangePicker` since iter 4h R2) holds
a local draft and commits to the URL on click of "Aplicar"; the draft
state is local until applied. Toggles that are *not* persisted in
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

**Date / time inputs use HeroUI DatePicker / DateRangePicker** —
never native `<input type="date">`. Native browser pickers break
visual coherence with the rest of the UI; the i18n-risk argument
that justified them in iter 3b is moot now that we use HeroUI's
locale-aware composition (the package routes through React Aria +
`@internationalized/date`). The Roadmap range picker (iter 4h R2)
is the canonical example of the controlled compound API — value is
a `RangeValue<DateValue>` from `@internationalized/date`, ISO
serialization is `value.toString()` (`yyyy-mm-dd` for `CalendarDate`),
ISO → `CalendarDate` is `parseDate(iso)`. Apply this rule to any
new date / time field across the product.

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

### Narrative editor (`/projects/[key]?view=narratives` + `narratives/[id]/edit`)

#### Routes & Server Actions

- `/projects/[key]?view=narratives` (iter 4g) — the **Narrativas** tab
  inside the project detail page. Embeds `NarrativesListPanel` (a
  Server Component, reusable) under the existing `KpiHeader`. Each
  card is a Client Component for its 3-dot menu and confirm-delete
  modal.
- `/projects/[key]/narratives` — **legacy URL**, now a 308
  `permanentRedirect` to `/projects/[key]?view=narratives` (iter 4g).
  Kept for external bookmarks; browsers and the Next router cache
  the hop. No project-key validation here — invalid keys 404 one hop
  later via `/projects/[key]`'s own `notFound()`.
- `/projects/[key]/narratives/[id]/edit` — Server Component loads the
  full narrative (`getNarrativeById`) and hands the tree to a Client
  shell. The route is desktop-first; a CSS-only `md:hidden` block
  renders a Card-hero fallback ("Editor disponible en pantallas más
  anchas") on small screens — same Prism vocabulary as the rest of
  the editor (iter 4h R3).
- `/projects/[key]/narratives/[id]/preview` — public read-only view
  (see "Narrative public view" section below).
- All mutations live in `src/app/actions/narratives.ts` ("use server").
  `revalidatePath` fires only on actions whose result the list panel
  needs to see (create / duplicate / delete / publish toggle); since
  iter 4g it targets `/projects/[key]` (where the tab embed renders).
  Editor-side actions skip revalidation because the editor patches
  its tree in place from the returned entity.

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

#### Shared field primitives (iter 4h R3)

`form-fields.tsx` is the single source of truth for input chrome
across the 5 edit forms:

- **`TextInput` / `Textarea`** — native `<input>` / `<textarea>` in
  the Prism input shell (rounded-md + border-border + focus ring
  primary-500). Skips HeroUI Input / TextField whose internal
  classes fight back when overridden.
- **`Field`** — implicit-association `<label>` + caption-style
  heading (xs uppercase tracking-wide font-medium text-text-secondary)
  + optional helper or error footers.
- **`SectionHeading`** — form-level h2 ("Narrativa" / "Fase" / etc.)
  in the same caption typography as Field labels.
- **`FormDeleteButton`** — destructive ghost-error pill at the foot
  of edit forms, sitting above a divider. Trash2 + label.
- **`DateInputField`** — wraps the verbose HeroUI DatePicker compound
  behind a one-line API (label + ISO string + onChange). The
  boundary stays an ISO `yyyy-mm-dd` string (matching the DB column
  type and the rest of the data layer); CalendarDate ↔ string
  conversion happens here. **Memory rule**: never use native
  `<input type="date">` anywhere in the product.

Textareas in all 5 forms drop `font-mono` — Geist Sans is the body
default and prose reads as prose. Identifiers (`R1`, `D1`,
`NOX-123`) keep `GeistMono.className` per the iter 4h R2 typography
rule.

#### Empty state on bootstrap (iter 4h R3)

`empty-states/EmptyNarrativeState.tsx` renders **below** the
`NarrativeForm` (not in place of it) when the narrative root is
selected and the tree has zero phases plus zero orphan workstreams.
The PM keeps editing title / subtitle / overview while looking at
two clear bootstrap CTAs: "Agregar primera fase" (primary) +
"Workstream sin fase" (secondary).

The `addPhase` and `addOrphanWorkstream` handlers live on
`EditorShell` with their own `useTransition` (`bootstrapping`),
distinct from `StructureSidebar`'s internal pending state. Both
hit the same Server Actions the sidebar's bottom CTAs already
invoke — same data-flow contract, two surfaces.

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

### Design system (Prism — iter 4h R1)

#### Tokens (Tailwind v4 `@theme`)

Defined in `src/app/globals.css` inside an `@theme` block; Tailwind v4
emits utility classes for each token (`bg-primary-500`,
`text-text-primary`, `rounded-md`, `shadow-md`).

**Color** — OKLCH for perceptual uniformity:
- `--color-primary-{50..900}` lavender / púrpura (brand).
- `--color-warm-{50,100,200,500,700}` peach / cream accents.
- `--color-cool-{50,100,200,500,700}` blue-grey accents.
- Tinted neutrals: `--color-bg`, `--color-surface`, `--color-border`,
  `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`.
- Functional pairs: `--color-success`/`-bg`, `--color-warning`/`-bg`,
  `--color-error`/`-bg`, `--color-info`/`-bg`.

**Radius** — bumped vs Tailwind defaults to match Aether-inspired
rounder shapes:
- `--radius-sm: 0.5rem`, `--radius-md: 0.75rem`,
  `--radius-lg: 1rem`, `--radius-xl: 1.5rem`.
- `--radius-2xl` and `--radius-3xl` keep their OOTB Tailwind values
  (`1rem` / `1.5rem`) — used directly by Card variants.

**Shadow** — purple-tinted ink, lighter than Tailwind's pure-black
defaults:
- `--shadow-sm: 0 1px 2px 0 oklch(0.20 0.01 290 / 0.05)`.
- `--shadow-md: 0 2px 8px 0 oklch(0.20 0.01 290 / 0.08)`.
- `--shadow-lg: 0 8px 24px 0 oklch(0.20 0.01 290 / 0.12)`.

**Typography**: Geist Sans (default body via `GeistSans.className` on
`<html>` in the root layout) and Geist Mono (exposed as
`--font-geist-mono` via `GeistMono.variable`; consumers that want
mono import `GeistMono` and apply `.className` on the specific span,
e.g. ProjectCard's project key).

#### Intentional override of HeroUI v3 tokens

`@theme` redefines names HeroUI v3 also tokenizes:
`--color-text-muted`, `--color-foreground`, `--color-surface`, etc.
Our values win because `@import "@heroui/styles"` runs before
`@theme`. **This is by design** — one product-wide visual identity
across HeroUI components and our own primitives. HeroUI components
on pages not yet redesigned inherit the new colors automatically.
After R2, every surface inside `/projects/[key]` (KpiHeader, tabs,
table, roadmap, narratives tab) consumes Prism primitives directly;
HeroUI is reserved for compound interactions we don't reimplement
(Drawer for the issue side panel, Modal + Dropdown for narrative
actions, DateRangePicker for the roadmap range, Tooltip / Popover).
Editor (`/narratives/[id]/edit`) and public preview (`/preview`)
still inherit only the global token override pending R3 / R4.
Accepted visual cost during the multi-round rollout; if a specific
HeroUI surface breaks visually we patch that surface, not the token.

#### UI primitives

Live under `src/components/ui/` and built on `tailwind-variants` (the
same lib HeroUI v3 uses internally). All accept `className` for
extension and forward refs.

- **`Card`** — variants `default` / `hero` / `compact`. Use this for
  simple "rounded surface with content" cases; HeroUI Card stays for
  compound (`Card.Header / Card.Title / Card.Description`) needs.
- **`Button`** — variants `primary` / `secondary` / `ghost` /
  `circular` × sizes `sm` / `md` / `lg` (compoundVariants give
  `circular` fixed square dimensions). Native `onClick` semantics.
- **`Chip`** — variants `status-todo|progress|done`,
  `severity-high|medium|low`, `accent`, `muted`. Renders `<span>`,
  non-interactive by design — wrap in a Link/button if needed.
- **`ActionButton`** — opinionated icon-only Aether-style circle,
  required `aria-label` at the type level. Pair with stretched-link
  cards by passing `tabIndex={-1} aria-hidden="true"
  className="pointer-events-none"` to make it decorative.
- **`Toggle`** (iter 4h R2) — switch primitive backing
  `<button role="switch" aria-checked>` with a styled track + thumb.
  Lavender `bg-primary-500` on / `bg-cool-200` off. Used wherever
  HeroUI Switch's raw blue clashed with the brand (project table
  filters, roadmap "Mostrar completadas").
- **`CurvedLines`** (in `Decorative.tsx`) — 4 staggered cubic-Bezier
  curves in a 1200×400 viewBox with `preserveAspectRatio="none"` +
  `vector-effect="non-scaling-stroke"`. Color via parent's
  `text-*` utility, opacity overridable via `className`.

#### Topbar architecture

Persistent header lives in `src/app/(app)/layout.tsx`. The `(app)/`
route group is the home of every authenticated surface that should
render under the topbar — `/`, `/projects`, `/projects/[key]`,
`/projects/[key]/narratives`, `/projects/[key]/narratives/[id]/edit`,
`/dev/components-preview`. The layout fetches `getCurrentUser()` once
per request and passes the user to `<Topbar>`.

**`/preview` opt-out**: `/projects/[key]/narratives/[id]/preview/`
sits OUTSIDE the `(app)/` group (it lives at the root-level
`app/projects/...` path). Same URL as before, just no topbar. The
two filesystem trees coexist because they define different leaf
URLs — `(app)/projects/[key]/...` resolves to `/projects/[key]/...`
for everything except preview, and `app/projects/[key]/narratives/[id]/preview`
resolves to that single leaf URL. No conflict on `[key]/[id]`.

Public routes outside `(app)/`: `/login`, `/auth/callback`,
`/api/sync`, `/api/cron/*` — same allowlist as the middleware.

**Topbar internals**:
- `Topbar.tsx` (Server) — brand "PRISM" Link + `TopbarNav` slot +
  `UserMenu` + `TopbarMobileMenu`. `max-w-7xl` inner container so
  the desktop nav aligns horizontally with the page-content column.
- `TopbarNav.tsx` (Client) — desktop items, `usePathname` for active
  state ("Proyectos" matches `/projects` + any subpath). "Settings"
  is a real disabled `<button>` with a "Próximamente" badge — not a
  fake `<Link>`, so keyboard tab stops are correct.
- `TopbarMobileMenu.tsx` (Client) — `md:hidden` hamburger button +
  HeroUI Drawer (controlled, same pattern as IssueDrawer). Drawer
  closes on Link click.

**UserMenu migration**: pre-iter-4h, `UserMenu` was mounted in
`/projects/page.tsx`, `KpiHeader.tsx`, and `EditorShell.tsx`, each
of which called `getCurrentUser()` independently. With UserMenu
now in the topbar, those mounts are gone — `getCurrentUser()` runs
once at the layout boundary, pages no longer fetch user data.
KpiHeader is now a synchronous Server Component (its only async dep
was UserMenu data).

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
  `20260505004354_add_project_stats_view.sql`, extended in
  `20260505213418_add_narratives_count_to_project_stats.sql`, granted
  to `anon` + `authenticated`): one row per project with
  `total_issues`, `done_issues`, and `narratives_count` aggregated
  server-side. The list page reads from it directly. Replaced an in-app
  group-by over a single `IN()` query that broke once total issues
  across projects went past PostgREST's default 1000-row response cap.
- **`security_invoker = true`** on the view: it executes with the
  caller's privileges and respects the underlying tables' RLS. When
  RLS tightens, the view follows automatically.
- **`narratives_count`** (iter 4g) is fetched via a derived-table
  LEFT JOIN over `project_narratives` rather than a third peer LEFT
  JOIN, so the issue COUNT stays a simple non-DISTINCT aggregate; two
  parallel LEFT JOINs to peer tables under one GROUP BY would
  Cartesian-multiply rows. `COALESCE(..., 0)` keeps the value `0`
  (never NULL) for projects without narratives. The list page uses
  it to render a "N narrativas" badge per ProjectCard, only when
  count > 0 (absence is the information).
- **`/projects/page.tsx` uses `getServerSupabase`** (iter 4f migration,
  cemented in iter 4g); the dashboard read carries the user session
  through the authenticated role. Today the result is unchanged
  because Jira tables have parallel `anon`+`authenticated` SELECT
  policies and `project_narratives` uses `auth_all USING(TRUE)`, but
  the contract is in place for when per-project membership lands.
- **Iter 4h R1 redesign**: hero rounded warm-cream block with
  `CurvedLines` decorative SVG and a secondary `SyncButton` for
  "Resincronizar"; grid (1 / 2 / 3 cols) of the new
  `components/projects/ProjectCard` (lead-initial avatar in a
  primary-100 circle + mono key + lead, divider, two big stats with
  uppercase captions, narratives `Chip` + decorative `ActionButton`
  in the footer). Empty state is a centered `Card variant="hero"` with
  `FolderOpen` icon and primary `SyncButton`.
- **Stretched-link + group-hover pattern** (extended in iter 4h R1
  with the new design tokens): wrapping `<div className="group relative">`
  + Card painted normally + decorative ActionButton with
  `pointer-events-none tabIndex={-1} aria-hidden` + chip `<Link relative z-10>`
  + stretched `<Link absolute inset-0>` rendered last in DOM. The
  group on the wrapper drives `group-hover:shadow-lg` on the Card so
  the lift cue triggers reliably regardless of HeroUI Card's internal
  classes. Use this pattern any time you need a clickable nested
  inside a clickable card.
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
- **Iter 4h R2 redesign**: every surface above is now Prism.
  `KpiHeader` → Card primitive grid with text-4xl page title +
  Clock-icon meta + functional-color KPI numbers. `ProjectViews` →
  custom underline-style tab bar (drops HeroUI Tabs); ARIA Tabs
  pattern with arrow / Home / End nav. `ProjectTable` → wrapped in a
  Card (`p-0 overflow-hidden`), type icon left of every key, hover
  `bg-warm-50`, `Toggle` primitive replaces HeroUI Switch.
  `ProjectRoadmap` → bars on Prism functional palette
  (`bg-error` overdue / `bg-info-bg` + `bg-info` overlay in-progress /
  `bg-cool-200` future / `bg-success-bg` done), chart wrapped in
  Card, `UnplannedCard` borderless rounded-2xl with hover-shadow,
  range picker uses HeroUI `DateRangePicker`. `StatusChip` migrates
  onto the Chip primitive; `AssigneeCell` drops HeroUI Avatar for a
  hand-rolled lavender circle; `DueDateCell` colors → Prism functional.
  Narratives tab: `NarrativeCard` migrates to the Card primitive,
  Publicada / Borrador badges → Chip variants. Saturated lavender is
  reserved for brand chrome (active tab underline, primary buttons,
  KPI accents) — never as a status; status colors stay functional.
- **Type icon helper**: `components/project/issueTypeIcon.tsx`.
  Returns `{ Icon, colorClass, label }` for Epic (`Zap` lavender) /
  Story (`BookmarkPlus` success) / Task (`CheckSquare` info) / Bug
  (`Bug` error) / Sub-task / fallback. Distinct from
  `narrative-public/issueTypeIcon.tsx` so iter R4 can refresh
  `/preview` icons independently.

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
- **HeroUI tokens are intentionally overridden** by Prism's `@theme` block (iter 4h R1). `text-muted`, `text-foreground`, `bg-surface`, `text-danger` etc. now resolve to our OKLCH palette. Don't try to "fix" this — it is the design contract.
- For new screens, prefer the **Prism UI primitives** in `src/components/ui/` (Card, Button, Chip, ActionButton) over raw HeroUI. Reach for HeroUI only when you need its compound API (`Card.Header / Title / Description`) or richer interaction (Tabs, Drawer, Dropdown, DatePicker).
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
