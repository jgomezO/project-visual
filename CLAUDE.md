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

**Iteration 4h Round 3:** Prism applied end-to-end on the narrative editor (`/projects/[key]/narratives/[id]/edit`). Seven commits, no functionality changes: (1) `EditorHeader` — Prism breadcrumb + Vista-previa pill secondary + Publicar Prism Button primary; `AutosaveIndicator` migrated to functional palette (`text-success` saved / `text-error` saved-with-error / `text-text-secondary` saving) and the retry trigger uses Prism Button variant=ghost. (2) `StructureSidebar` — type icons per node (`BookText` / `Layers` / `GitBranch` / `Link2` / `AlertTriangle`, all neutral text-text-secondary so they don't compete with Jira-issue-type icons elsewhere); floating-right status / severity dots on Phase and Risk rows (4 colors per status, 3 per severity); `selectableRowClasses` rewritten with `border-l-2 border-l-primary-500 bg-primary-100 text-primary-900 font-medium` for the active state and a transparent border-l in idle so geometry stays constant across selections; "+ Agregar X" bottom CTAs as ghost-primary. (3) Forms — new shared `form-fields.tsx` with `Field` / `TextInput` / `Textarea` / `SectionHeading` / `FormDeleteButton` / `DateInputField`; the 5 edit forms (Narrative / Phase / Workstream / Dependency / Risk) and the 2 list panels (Dependencies / Risks) all flow through these primitives. Textareas drop `font-mono` (Geist Sans default takes over) so prose reads as prose; identifiers (R1, D1, NOX-123) ride `GeistMono.className`. Native `<input type="date">` in PhaseForm and DependencyForm migrated to HeroUI `DatePicker` via `DateInputField` — closes the date-input gap left after R2. (4) `BulletListInput` — colored dots replace numeric bullets via a new `tone` prop (RiskForm passes `tone="danger"` for impacts and `tone="success"` for mitigations); shared `TextInput` chrome; ghost-primary "+ Agregar item". No reorder buttons added (the up/down spec mockup was a feature change, deferred). (5) Autocompletes — `JiraIssueKeysInput` and `PodAutocompleteInput` get rounded-xl shadow-lg dropdowns with `hover:bg-primary-50` / `focus-visible:bg-primary-100` rows; chips repainted (lavender for found, warm-100 hydrating, warning-bg + AlertTriangle for missing-from-sync). (6) New `empty-states/EmptyNarrativeState.tsx` — Card hero rendered BELOW NarrativeForm (not in place of it) when the narrative root is selected and the tree has zero structure; two CTAs powered by `addPhase` / `addOrphanWorkstream` lifted to EditorShell. Mobile fallback (`md:hidden`) repainted as a Card hero with Monitor icon. NarrativeCard's delete confirmation modal gains an AlertTriangle icon in an error-bg circle. The sidebar's `window.confirm` delete prompts stay native — replacing them would have been a new state machine, out of R3 polish scope.

**Iteration 4h Round 4 (current):** Prism applied end-to-end on the public narrative preview (`/projects/[key]/narratives/[id]/preview`) and its presentation-mode toggle. Final round of the multi-round design-system pass; nine commits, no functionality changes. (1) `NarrativeView` gains a plain-text PRISM logo (no link — external audiences can't follow auth-protected routes), `data-preview="true"` on the root for print scoping, severity / critical / metadata chips and "Leer más" migrated to Prism `bg-error-bg` / `text-error` / `text-primary-700`; `DraftBanner` switches AlertTriangle → AlertCircle and adopts the warning palette; `globals.css` adds `print-color-adjust: exact` scoped to `[data-preview="true"]` so printed pages preserve every Prism cue (without it Chrome / Safari strip backgrounds + colored chips by default). (2) `NarrativePattern` decorative SVG — concentric quarter-circle arcs anchored at the top-right (4 arcs at radii 120 / 240 / 360 / 480, viewBox 600×400). A second decorative voice next to `CurvedLines` so the preview doesn't read as a re-skin of `/projects`: arcs = broadcast / amplification (the narrative shared outward), curves = movement / continuity (the project moving forward). Mounted on the NarrativeView root with `relative isolate overflow-hidden` + `-z-10` + `data-print="hide"`; consumer-driven opacity so presentation mode dims to `opacity-[0.04]` cleanly. (3) `StatusSummaryCard` — Prism Card shape (`rounded-2xl shadow-md p-6`) with a lavender lateral accent (`border-l-4 border-primary-500`) and a soft `bg-primary-50/40` wash; kept as `<section>` for `aria-labelledby`. (4) Phase sections — STATUS_PALETTE migrates to Prism functional tokens (completed → success, upcoming → muted neutral, at_risk → warning + `text-warm-700` chip text since `text-warning` at L=0.75 is too light for chip text on warning-bg). `in_progress` → primary-700 LAVENDER, an INTENTIONAL asymmetry with the operational roadmap which uses BLUE (see "in_progress lavender vs blue asymmetry" callout in the design-system section below). (5) Workstream cards + issue rows + the R2-promised `narrative-public/issueTypeIcon` migration: Epic → `text-primary-700` (lavender — an epic is the largest narrative unit), Story → success, Task → info, Bug → error, Subtask → text-muted, Other → text-muted/60. `WorkstreamCard`'s ProgressBadge gets a three-bucket lavender scale (success at 100%, primary at ≥50%, warm-100 below). `IssueChip` migrates to border-border / bg-warm-50/60 + Prism text tokens; missing-from-sync row to warning palette + `text-warm-700`. (6) DependencyCard's four-step risk escalation — low → `text-muted/40`, medium → `warning`, high → `warm-700`, critical → `error`. Prism doesn't ship a token between warning and error, so `warm-700` covers the gap by reusing the warm hue family at a darker lightness. `DateGapIndicator` and `CommitmentStatusChip` both migrate to Prism functional palettes (neutral → warm-100, success → success-bg/success, info → info-bg/info, warning → warning-bg + warm-700 text, error → error-bg/error). (7) RiskCard — three-bucket SEVERITY_BORDER (low → muted, medium → warning, high → error) and a redesigned 2-col grid for impacts vs mitigations: each section is a soft `bg-warm-50/60` box with semantic-coloured caption + bullet markers (`marker:text-error` for impacts, `marker:text-success` for mitigations). Keeping the boxes neutral and pushing colour to the marks avoids the page feeling loud when both buckets are filled. New `PreviewFooter` — plain text "Creado con Prism · Veevart", NO link (same external-audience reasoning as the PRISM logo: internal routes are auth-gated, a link would either bounce stakeholders to /login or leak the dashboard's existence). (8) Presentation-mode polish: `max-w-[1200px]` → `max-w-5xl` (1024px) normal / `max-w-6xl` (1152px) presentation across action bar / main / DraftBanner / footer; tighter reading column on standard, slightly roomier in presentation. Top action bar (PRISM logo + Editor link + toggle) and PreviewFooter both hide via `group-data-[mode=presentation]/preview:hidden`; ESC remains the documented exit (surfaced via the toggle's title="Salir (ESC)" in normal mode). H1 typography clamps `text-5xl` on small viewports → `text-7xl` from `sm+` in presentation, with `text-balance` on the H1 keeping long titles wrapping cleanly. `<main>` gap grows from gap-8/sm:gap-10 → gap-12/sm:gap-16 in presentation. (9) These docs.

After R4 the multi-round Prism rollout is complete: every internal surface (`/projects`, `/projects/[key]`, narrative editor, public preview) consumes Prism primitives directly. Subsequent visual work should be feature-driven, not round-driven.

**Iteration 9 (soft-delete detection + user docs):** Two sub-iters bundled. **9a (detection)** adds a `deleted_at TIMESTAMPTZ DEFAULT NULL` column to `issues` (migration `20260508221954_add_deleted_at_to_issues.sql`) with a partial index `WHERE deleted_at IS NOT NULL` — the common active-only path keeps using `project_id`/`key` indexes and the minority "show deleted" path now has dedicated index support without bloating the dominant case. Detection lives in `src/lib/sync/detect-deleted.ts` — `detectDeletedIssues(projectId, freshKeys, supabase)` compares the keys returned by Jira against what's in the DB and runs two batched UPDATEs: keys in DB but not in `freshKeys` get `deleted_at = NOW()`, previously-tombstoned keys that reappear get `deleted_at = NULL` (auto-restore). No threshold, no rollback — bad-data windows self-heal because tombstones can be restored. The helper is invoked from `syncIssuesForProject` AFTER the parent + link backfills and BEFORE the `last_synced_at` stamp, **gated to `isFull` only**: incremental syncs return just the slice updated since the watermark, so absence ≠ deletion there. Any earlier exception in the pipeline propagates before detection runs, so `deleted_at` is only ever mutated on a clean full sync. `SyncIssuesResult` and `RunSyncResult` gain `issuesMarkedDeleted` / `issuesRestoredFromDeleted`; `sync_runs.issues_deleted` (column present since iter 1, never written) now persists the marked count on every return path. A second migration `20260511153148_filter_deleted_from_aggregations.sql` updates the `project_dashboard()` RPC and the `project_stats` VIEW to filter `deleted_at IS NULL` (FILTER clauses on COUNTs, plus the issue_stats / blocked_stats CTEs in the RPC) — without this, the KPI header would have kept counting tombstoned rows while the table hid them, breaking coherence. UI surfaces: (1) `ProjectTable` gains a third filter Toggle "Show deleted" (default OFF, **only rendered when `rows.some(r => r.deleted_at !== null)`** — absence is the information), with deleted rows rendering opacity-60 + line-through on the summary + a Trash2 icon wrapped in `<span title>` (Lucide icons don't surface `title` as a prop) between the type icon and the key; the status chip is intentionally preserved as the last-known state. (2) `ProjectRoadmap` filters tombstones at an entry-point `activeRows` useMemo so every downstream computation (`allEpics`, `allPlanned`, `unplannedCount`, `UnplannedSection`) agrees — divergence F from the original spec accepted, the roadmap is a planning surface where deleted work has no place and no toggle was added. (3) `narrative-public/IssueChip` gains a third variant (after "found" and "missing-from-sync"): opacity-70 row + line-through key + line-through summary + Trash2 next to type icon + tooltip "Deleted in Jira on {date}". Status chip preserved, **Jira link intentionally dropped** because the page upstream no longer exists. (4) `WorkstreamCard`'s CountsRow appends "N deleted" between "issues" and "overdue" when `deletedKeys.length > 0`. (5) `DependencyCard`'s ProviderBlock surfaces "N deleted" alongside the existing "N not synced" counter in neutral text-muted tone. (6) `JiraIssueKeysInput` adds `.is("deleted_at", null)` to the autocomplete query so deleted issues never suggest; the hydration path **intentionally skips this filter** so already-linked deleted chips render with the new tombstoned variant (gray + Trash2 + line-through + tooltip + remove-X preserved) — the PM has to decide whether to remove or replace the dead reference. Derived layer in `src/lib/narratives/derived.ts`: `IssuePublicData` + internal `ChildIssue` gain `deleted_at`; `WorkstreamDerived` gains `deletedKeys: string[]` (disjoint from `missingKeys` — deleted ≠ never-synced); `ProviderIssuesData` gains a third `deleted: IssuePublicData[]` bucket; `computeWorkstream` treats deleted as a third bucket (excluded from `byCategory` / `overdueCount` / `linked` / `progress`); `computeIssueProgress` filters deleted children before recursing — a parent whose only loaded children are tombstoned reverts to leaf treatment based on its own status (most honest fallback when the descendant graph dies); `countUniqueFoundIssues` skips deleted from the global header total. Test coverage extends to 74 tests: `detect-deleted.test.ts` (8 cases — empty inputs, steady state, mark, restore, mixed, no-op on already-deleted, project_id scoping, all-active-deleted) with a hand-rolled in-memory fake of the supabase-js fluent builder (the helper takes supabase by parameter for injection, no vi.mock needed); 5 new cases in `derived.test.ts` under "soft-deleted issues (iter 9a)" cover surfaces-in-deletedKeys, excluded-from-progress-denominator, all-deleted-workstream, deleted-child-filtered-from-recursive-walk, totalIssues-excludes-deleted. The 20 pre-existing derived tests pass unchanged because `makeIssue` gained an optional `deletedAt` param (default null); a new `makeChild` helper replaces two inline `Array<{ key, status_category }>` ad-hoc types. New i18n: 7 strings total across `projectDetail.list.filters.showDeleted`, `projectDetail.list.deleted.{iconAria,tooltip}`, `preview.workstream.counts.deleted`, `preview.issueChip.{deletedLabel,deletedTooltip}`, `preview.dependency.provider.deleted`, `narratives.inputs.jiraIssues.chip.{deletedLabel,deletedTooltip}` — voseo + preserved-terms ES ("borrada en Jira el {date}") consistent with iter 5 conventions. **9b (user docs)** ships `/docs/` — seven markdown files for the Veevart PM audience in Spanish: README index, `01-introduccion.md` with a 16-entry glossary using explicit `<a id="glosario-X"></a>` anchors so cross-refs resolve in every renderer, `02-empezar.md`, `03-narrativas.md` (the longest doc — primary PM workflow), `04-vista-publica.md` (with explicit `<a id="quien-puede-ver"></a>` ASCII anchor on the accented heading targeted cross-doc), `05-ai-assist.md`, `06-faq.md` (canonical home of the "what happens if an issue is deleted in Jira" explainer; other docs link here). Anti-duplication discipline: glossary defined once in 01, external-audience sharing options only in 04, AI assist details only in 05, login/domain mechanics only in 02. Four sites carry `[completar con canal de soporte]` with adjacent HTML TODO comments — single grep-and-replace pivot when the support channel is named.

**Iteration 8 (testing + CI gate):** First test surface lands. Vitest 4 with co-located `*.test.ts(x)` files; `environment: "node"` (no jsdom — iter 8 covers pure libs only). 61 tests across 5 files, ~250ms run: `formatActor` smoke (10), `runSync` decision tree per the iter 6 contract (8), `computeDerived` recursive progress + `deriveRiskLevel` precedence (20), pricing math (7), and `workstream-description` prompt builders + SYSTEM_PROMPT contract guards (16, with inline snapshots for the structural format). Mock strategy: replace helper modules at the import boundary (`vi.mock('./runs')`, `vi.mock('./projects')`, `vi.mock('./issues')`, `vi.mock('@/lib/jira/client')`) instead of mocking Supabase / Jira directly — iter 8 tests are about decision trees and pure computation, not the inner library wiring. `test-utils/server-only.ts` stub aliased via `vitest.config.ts → resolve.alias` so server-only modules under test don't crash at import (Node environment, not RSC). New scripts: `test`, `test:watch`, `test:ui`, `typecheck` (split out from lint so CI can stage them as separate steps). GitHub Actions workflow at `.github/workflows/ci.yml` triggers on push to main + pull_request to main, runs lint + typecheck + tests with pnpm cache via `setup-node@v4`'s `cache: pnpm`. Concurrency group cancels superseded runs; install uses `--frozen-lockfile` to fail on lockfile drift. No secrets needed — every test mocks at the module boundary. **Pre-iter-8 fix**: a real `react-hooks/rules-of-hooks` violation in `ProjectRoadmap.tsx` (early return before two `useMemo` calls) was caught by `pnpm lint` during commit-6 verification and fixed in its own commit before iter 8 proceeded; React 19 strict mode would have crashed on the "0 epics → N epics" transition. Nine remaining `react-hooks/set-state-in-effect` + `react-hooks/refs` lint findings are intentionally suppressed per-site with `eslint-disable-next-line` + a per-site reason + a TODO post-iter-8 (option δ from the iter 8 plan: keeps strictness for new code, co-locates the deuda with the pattern, supports incremental cleanup as we refactor each file).

**Iteration 7 (AI assist — workstream descriptions):** First AI capability shipped. Two operations on the workstream description field in the narrative editor: `'generate'` (button when description is empty) streams Claude Haiku 4.5 output directly into the field; `'refine'` (button when description has content) opens an `AIRefineModal` with split-view (your original ↔ AI refined) and three actions (Keep original / Refine again / Use refined version). Wire format is SSE (`text/event-stream`) over POST `/api/ai/workstream-description`, consumed by `useWorkstreamDescriptionAI` hook with `fetch + ReadableStream + AbortController`. New table `ai_usage` (migration `20260507194722_add_ai_usage_table.sql`) is the immutable audit log: per-user RLS read-only, service-role writes only, columns for input JSONB / output / token counts / cost_usd DECIMAL(10,6) / duration / status (`success | error | cancelled`) / `triggered_by`-style `operation` (`generate_workstream_description | refine_workstream_description`). Three error surfaces classified end-to-end: (a) HTTP errors from our route (401 unauthorized / 404 issuesNotFound / 429 rateLimited / 5xx serviceUnavailable) mapped via `mapHttpStatus` in the hook; (b) in-stream Anthropic SDK errors classified into `AIErrorCode` (`config | rate | service | timeout | generic`) by `classifyAnthropicError` in the route handler and surfaced via SSE error frames with an `errorCode` field; (c) stream-closed-early (likely Vercel function timeout) detected after the reader exits without seeing a terminal frame, surfaced as `timeout`. Anthropic SDK pinned to `claude-haiku-4-5-20251001` (snapshotted, NOT the alias — alias drift would silently change prompt behavior). Pricing constants in `src/lib/ai/usage/pricing.ts` verified against anthropic.com/pricing on 2026-05-07. New env var `ANTHROPIC_API_KEY` (server-only). Middleware allow-lists `/api/ai/*` alongside `/api/sync` and `/api/cron/*`. i18n strings under `narratives.ai.*` (en + es); Spanish preserves "AI" + "issues" terms per CLAUDE.md preserved-terms list. Spend limit on the Anthropic Console is the only safety net — no per-user app-layer rate limiting today.

**Iteration 6 (cron sync):** Daily automated Jira sync via Vercel Cron on Hobby plan. `vercel.json` declares one cron entry hitting `GET /api/cron/sync-jira` at `0 6 * * *` (06:00 UTC = 01:00 Colombia / 03:00 Argentina — pre-workday everywhere we operate, Vercel valley hours). The cron route handler verifies `Authorization: Bearer ${CRON_SECRET}` (Vercel attaches this automatically) and calls `runSync({ triggeredBy: 'cron' })` directly — NOT a self-fetch to `/api/sync`. Direct call avoids stacking two serverless functions against the 60s Hobby budget and keeps `SYNC_SECRET` out of the cron path. `runSync` rewritten with per-project resilience: each `syncIssuesForProject(key)` runs inside its own try/catch, so one project's Jira hiccup no longer aborts the whole run. Aggregate status decision: `'success'` (every project clean), `'partial'` (some OK, some failed), `'failed'` (none OK or pre-loop abort). HTTP status: success/partial → 200, failed → 500. New `sync_runs` columns: `triggered_by` ('manual' | 'cron') and `failed_projects` JSONB array of `{projectKey, error}` entries. The status CHECK extended to allow `'partial'`. Migration `20260507165439_extend_sync_runs_for_cron.sql`. UI: `/projects` Hero shows a `SyncStatusBadge` (warning chip for partial, error chip for failed) with a HeroUI Popover detailing run id, trigger source, and per-project errors. Returns null on success / no-run-yet so the happy-path layout is unchanged. Loader queries TWO sync_runs rows in parallel: last-success (drives Hero subtitle "Last sync: 1 day ago") + last-finished-any-status (drives the badge — surfaces a partial today even when yesterday's success is still the most recent OK). Manual sync via the Hero `SyncButton` keeps working unchanged; the Server Action now stamps `triggered_by: 'manual'` so a future operations split between scheduled-health and PM-clicks is one query away. `maxDuration = 60` on the cron route. `CRON_SECRET` configured in Vercel dashboard, never in committed `.env`.

**Iteration 5 (i18n):** Big-bang internationalization via `next-intl@4.11`. English is the new `defaultLocale` (no Accept-Language detection — `localeDetection: false`); Spanish (Argentinian voseo where it lands naturally) ships beside it. URL contract is `localePrefix: "always"`, so every authenticated path now lives under `/<locale>/...` (e.g. `/en/projects`, `/es/projects/[key]/narratives/[id]/edit`). Filesystem restructure: every page route moved under `src/app/[locale]/`, route handlers (`/api/sync`, `/auth/callback`) stay at the root unprefixed. The middleware combines `intlMiddleware` (locale resolution + cookie write) with the existing Supabase auth gate in three steps: bypass route handlers + cron, run intlMiddleware first and short-circuit on its redirect, then run `getUser()` on locale-prefixed paths and chain the refreshed cookies onto the intl response. Messages live as one JSON per domain per locale (`messages/{en,es}/{common,auth,topbar,projects,projectDetail,narratives,preview,errors}.json`) and are merged into a single `IntlMessages` tree by `src/i18n/request.ts`; type-safe `t()` is wired through `messages/en.d.ts` + `global.d.ts`. Server Components call `getTranslations()` / `getFormatter()`; Client Components call `useTranslations()` / `useFormatter()`. ICU plural messages replace every `${n} thing${n === 1 ? "" : "s"}` concatenation across the codebase. Every hardcoded `Intl.DateTimeFormat("es-AR")` / `relativeFromNow` helper is gone — date and relative-time formatting now route through `format.dateTime({ timeZone: "UTC" })` / `format.relativeTime(date)`. The request config returns `now: new Date()` so the server has a request-scoped reference time; the `[locale]/layout.tsx` forwards it to `<NextIntlClientProvider now={now}>` via `getNow()` so client `format.relativeTime` shares the same anchor — without this, SSR and CSR drifted and next-intl emitted `ENVIRONMENT_FALLBACK` warnings. Locale-aware navigation comes from `src/i18n/navigation.ts` (`Link`, `useRouter`, `usePathname`, `redirect`, `getPathname` from `createNavigation(routing)`); raw `next/link` and `next/navigation` are reserved for cases where locale prefixing is the wrong behaviour (today: search-params manipulation in `PresentationModeToggle`, where the path is locale-agnostic relative). A `LanguageSwitcher` component (HeroUI Dropdown trigger showing the current code uppercase, items in their native names) mounts in the `Topbar` and in the `NarrativeView` preview top action bar; the latter hides automatically in presentation mode via the parent's `group-data-[mode=presentation]/preview:hidden`. The narrative `formatActor` helper now takes a translator (`(key: "system") => string`) — `null` / `"system"` legacy rows render as `"Sistema"` (es) or `"System"` (en) without the helper hardcoding either. Server-thrown errors (Supabase mutation failures, etc.) are NOT translated in this iter — only UI-side fallback copy is; documented as TODO. The `/preview` view stays auth-walled in iter 5 — tokenized public share links remain a future iteration.

## Stack

- Next.js 16 (App Router) + TypeScript
- React 19, Turbopack
- HeroUI v3 (`@heroui/react`, `@heroui/styles`, `tailwind-variants`)
- Tailwind CSS v4 (CSS-first config, `@tailwindcss/postcss` plugin)
- `geist` (Vercel-canonical Geist Sans / Mono) — installed iter 4h R1, replaces the Next.js Google Fonts Geist that was scaffolded
- `@internationalized/date` — direct dep since iter 4h R2 (powers HeroUI's DatePicker / DateRangePicker)
- `next-intl@4.11` — direct dep since iter 5; powers locale routing, message loading, type-safe `t()`, ICU plurals, locale-aware date / relative-time formatting
- `@anthropic-ai/sdk@0.95` — direct dep since iter 7; powers AI assist for workstream descriptions (generate + refine via streaming Claude Haiku 4.5)
- `vitest@4` + `@vitest/ui` — devDeps since iter 8; test runner with native tsconfig-paths resolution and inline snapshot support
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
pnpm typecheck          # tsc --noEmit (iter 8 — split from lint so CI stages them separately)
pnpm test               # Vitest run-once (CI mode)
pnpm test:watch         # Vitest interactive watch (dev loop)
pnpm test:ui            # Vitest browser UI (visual inspector)
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
| `CRON_SECRET`                     | server  | Required by `GET /api/cron/sync-jira` via `Authorization: Bearer …` header. Vercel Cron attaches this header automatically on scheduled invocations (iter 6). Configure in Vercel dashboard, NOT in committed `.env`. Generate with `openssl rand -base64 32`. |
| `ALLOWED_EMAIL_DOMAINS`           | server  | Comma-separated whitelist for Google OAuth login. Server-only. Domain check fails closed if unset/empty (refuses every login). |
| `ANTHROPIC_API_KEY`               | server  | API key for Claude Haiku 4.5 (iter 7 — AI assist for workstream descriptions). Generate at https://console.anthropic.com/settings/keys. Configure spend limit in the Console as the only runaway-cost guard (no app-layer rate limiting). Server-only; never bundled to client. |

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
    │   ├── index.ts                runSync({type?, projectKey?, triggeredBy?}); describeError() handles PostgrestError
    │   ├── projects.ts             syncProjects()
    │   ├── issues.ts               syncIssuesForProject() — parent_id 2nd pass + link backfill + isFull-gated detectDeletedIssues call (iter 9a)
    │   ├── detect-deleted.ts       (iter 9a) detectDeletedIssues(projectId, freshKeys, supabase): two-way tombstone reconcile, supabase injected for testability
    │   └── runs.ts                 sync_run lifecycle (open / succeed / fail / partial)
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
    ├── 20260505213418_add_narratives_count_to_project_stats.sql              (iter 4g Migration C)
    ├── 20260507165439_extend_sync_runs_for_cron.sql                          (iter 6 — triggered_by + 'partial' status + failed_projects JSONB)
    ├── 20260507194722_add_ai_usage_table.sql                                 (iter 7 — AI assist audit log)
    ├── 20260508221954_add_deleted_at_to_issues.sql                           (iter 9a — soft-delete tombstone column + partial index)
    └── 20260511153148_filter_deleted_from_aggregations.sql                   (iter 9a — exclude deleted_at IS NOT NULL from project_dashboard RPC + project_stats view)

vercel.json                                  (iter 6 — declares the daily cron entry; root of repo, alongside next.config.ts)

docs/                                        (iter 9b — Spanish user guide for PMs)
├── README.md                                (index + cross-ref conventions)
├── 01-introduccion.md                       (what Prism is + 16-entry glossary with explicit anchors)
├── 02-empezar.md                            (login, three tabs, language switch, manual resync)
├── 03-narrativas.md                         (primary PM workflow — longest doc)
├── 04-vista-publica.md                      (preview surface, presentation mode, print, sharing constraints)
├── 05-ai-assist.md                          (workstream description generate/refine)
└── 06-faq.md                                (frequency-ordered; canonical home of "what happens if an issue is deleted")
```

Plus inside `src/`:
- `src/app/api/cron/sync-jira/route.ts` (iter 6) — GET handler invoked by Vercel Cron once per day. Verifies `Authorization: Bearer ${CRON_SECRET}`, calls `runSync({ triggeredBy: 'cron', type: 'full' })` directly (iter 9c — `type: 'full'` was added so tombstone detection can fire). `maxDuration = 60`.
- `src/components/projects/SyncStatusBadge.tsx` (iter 6) — Client. Chip + HeroUI Popover surfacing a partial/failed last run on the `/projects` Hero.
- `src/app/api/ai/workstream-description/route.ts` (iter 7) — POST + SSE for AI assist. `maxDuration = 60`. See "AI assist (iter 7)" section.
- `src/lib/ai/` (iter 7) — `client.ts` (lazy + cached Anthropic SDK), `prompts/workstream-description.ts` (pure prompt builders), `actions/workstream-description.ts` (non-streaming runner — kept for symmetry, not currently wired), `usage/pricing.ts` (cost helper, verified-date stamped), `usage/log.ts` (admin-client INSERT into ai_usage), `error-codes.ts` (shared `AIErrorCode` union).
- `src/components/narrative-editor/useWorkstreamDescriptionAI.ts` (iter 7) — Client hook owning the SSE consumer (POST + ReadableStream + AbortController + SSE frame parser).
- `src/components/narrative-editor/AIRefineModal.tsx` (iter 7) — Client. HeroUI Modal with split-grid (original ↔ refined) and three-button footer (Keep original / Refine again / Use refined version).

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

### Internationalization (iter 5)

Big-bang migration to `next-intl@4.11`. Every authenticated path is locale-prefixed (`/en/...`, `/es/...`); only route handlers (`/api/sync`, `/auth/callback`) and the legacy filesystem root stay unprefixed.

#### Files & responsibilities

- **`src/i18n/routing.ts`** — single source of truth: `defineRouting({ locales: ["en", "es"], defaultLocale: "en", localePrefix: "always", localeDetection: false })`. Exports the `Locale` type. Adding a third locale starts here.
- **`src/i18n/request.ts`** — server-side `getRequestConfig`: resolves the active locale, `Promise.all`-loads the eight domain JSON trees (`common, auth, topbar, projects, projectDetail, narratives, preview, errors`), merges them under top-level namespaces matching the file names, and returns `{ locale, messages, now }`. The bundler splits per locale because the imports are dynamic — `/es/...` requests don't pull the English JSON tree. The `now: new Date()` is a request-scoped reference time; without it, `format.relativeTime` falls back to `new Date()` per render and SSR/CSR drift.
- **`src/i18n/navigation.ts`** — re-exports `Link, redirect, usePathname, useRouter, getPathname` from `createNavigation(routing)`. Use these for any internal navigation that should respect the active locale prefix. Raw `next/link` / `next/navigation` is reserved for surfaces that are locale-agnostic (today: `PresentationModeToggle`, which only manipulates search params on the current path).
- **`src/middleware.ts`** — combined intl + auth. Three steps in order: (1) bypass route handlers + cron paths (return early); (2) run `intlMiddleware(req)` and short-circuit if it returned a redirect (locale resolution + `NEXT_LOCALE` cookie write live there); (3) on locale-prefixed paths, run `supabase.auth.getUser()` against the auth server (NOT `getSession()`), gate `/login`-protected and `/login`-redirect cases, and **chain refreshed cookies** onto the intlResponse via `preserveCookies()` so the browser stores them immediately.
- **`src/app/[locale]/layout.tsx`** — root locale layout. Calls `setRequestLocale(locale)` (required for Server Components under this segment), validates the locale against `routing.locales` (404 on unknown — defensive, the middleware should never let one through), reads `now` via `getNow()`, and wraps children in `<NextIntlClientProvider now={now}>` so Client Components share the same reference time as Server.
- **`messages/{en,es}/*.json`** — eight domain files per locale. Multi-file split keeps each tree small enough to scan and diff. Adding a new domain: drop a JSON pair, add the import in `request.ts`, add the type-imports in `messages/en.d.ts`, add the key to the `Messages` type.
- **`messages/en.d.ts` + `global.d.ts`** — type augmentation. `en.d.ts` re-imports the eight English JSONs and exposes a `Messages` type; `global.d.ts` declares `interface IntlMessages extends Messages {}` so `useTranslations` / `getTranslations` autocomplete every key path.

#### Server vs Client message access

| Context | Translation | Formatter | Notes |
| ------- | ----------- | --------- | ----- |
| Server Component | `await getTranslations("ns")` | `await getFormatter()` | Components must be `async`. Call sites await the JSX result naturally — no extra wiring. |
| Client Component | `useTranslations("ns")` | `useFormatter()` | Both are React hooks, only valid inside Client Components. |
| Components without `"use client"` consumed by a Client Component | `useTranslations` | `useFormatter` | They're bundled to the client by their consumer. Adding hooks turns them into proper client components — that's fine when every consumer is already client. Document the boundary in a top-of-file comment so a future server consumer doesn't get a runtime error. |

`IssueChip`, `CommitmentStatusChip`, `DateGapIndicator` are the canonical examples of the third row — leaf components that always render inside a Client parent (`WorkstreamCard` / `DependencyCard`) and use hooks accordingly.

`SeverityBadge` and `RiskCard` are the canonical examples of pure server: rendered only by `RisksSection` (server), so they stay `async` + `getTranslations`.

#### Formatting helpers

- **Dates**: every date formatting goes through `useFormatter().dateTime` / `getFormatter().dateTime` with `timeZone: "UTC"` to match how we store ISO date columns. `Intl.DateTimeFormat("es-AR")` is forbidden — the migration removed every call site in iter 5.
- **Relative time**: `format.relativeTime(new Date(iso))` with the request-scoped `now` (forwarded via `getNow()` → `NextIntlClientProvider`). No more `relativeFromNow` helper — it was deleted.
- **Plurals**: ICU MessageFormat for everything that was `${n} ${n === 1 ? "thing" : "things"}`. Pattern: `"{count, plural, one {# thing} other {# things}}"`. Even when the English copy doesn't change (`"{n} in critical state"` for both 1 and N), keep the plural form so other locales can split — Russian, Polish, etc. won't be one-off changes later.
- **Actor**: `formatActor(value, t)` in `src/lib/format/actor.ts` takes a translator (`(key: "system") => string`) and returns `t("system")` for null / `"system"`. Legacy rows from before iter 4f stay readable as "Sistema" / "System" without the helper hardcoding either. Use `formatActorRaw(value)` (returns `null` for system) for non-i18n contexts.

#### Translation workflow

When adding new copy:

1. Draft the English JSON proposal first. Present it for review BEFORE applying anywhere.
2. After English is approved, draft the Spanish version together with the user. Voseo argentino where natural; preserve English terms that the team uses internally untranslated (`Workstream`, `Lead`, `Bug`, `Roadmap`, `Settings`, `issues`, `Markdown`, `Rationale`, `escalations`, `key`, `sync`, `PoD`, `Provider`, `cross-team`).
3. Only AFTER both JSONs are reviewed: apply them and refactor the components.
4. Run `npx tsc --noEmit` to catch any missing key (the typed `t()` will fail at compile time).
5. Don't run `pnpm build` mid-iteration if the dev server is running (Turbopack persistent cache can compaction-warn). Use `npx tsc --noEmit` instead — it doesn't touch `.next`.

This gate-on-English workflow is non-negotiable for this codebase. Don't skip it.

#### Shared enums (`common.json`)

Five enums are shared across multiple namespaces and live under `common`:
- `common.phaseStatus.{upcoming, in_progress, completed, at_risk}` — used by editor `PhaseForm` Select AND public `PhaseSection` badge.
- `common.commitmentStatus.{proposed, agreed, confirmed, at_risk, blocked}` — used by editor `DependencyForm` Select AND public `CommitmentStatusChip`.
- `common.riskSeverity.{low, medium, high}` — used by editor `RiskForm` Select AND public `SeverityBadge`.
- `common.issueType.{epic, story, task, bug, subtask, other}` — used by `narrative-public/issueTypeIcon` (and ready for the project-flavor helper to consume).
- `common.actor.system` — used by `formatActor`.

Sharing them prevents the editor's option labels and the public chip labels from drifting. **Don't duplicate enums into per-domain files** — promote to `common` if a second consumer appears.

#### Language switcher

`src/components/LanguageSwitcher.tsx`. HeroUI Dropdown with the current locale code uppercased (`EN` / `ES`) as the trigger and the native names (`English`, `Español`) as items. On select: `router.replace(pathname + queryString, { locale: next })` from `@/i18n/navigation` — the locale-aware router prepends the new prefix AND writes the `NEXT_LOCALE` cookie so the choice persists across sessions. Search params are preserved explicitly via `useSearchParams().toString()` so `?view=narratives`, `?from=…&to=…`, `?mode=presentation` survive the swap.

Mounted in two places:
- `Topbar` — between `TopbarNav` and `UserMenu`. Visible across every authenticated page.
- `NarrativeView` preview top action bar — before `PresentationModeToggle`. Auto-hides in presentation mode via the parent's `group-data-[mode=presentation]/preview:hidden`.

NOT mounted on `/login` — single-shot UX, the cookie/default handles it. If a stakeholder needs to switch on the login page itself, that's a small follow-up.

#### What's NOT translated

- **Server-thrown errors** (Supabase mutation failures, Jira API errors, validation messages thrown from `mutations.ts`). UI-level fallbacks ARE translated, but the underlying `Error.message` strings stay English. Translating server errors means routing every throw through a translator — a substantial refactor that's TODO.
- **Jira-domain values**: `status_category` ("To Do" / "In Progress" / "Done"), `status_name`, `priority`, `issue_type` raw strings, project keys, environment variables. These are upstream identifiers, not UI copy.
- **Brand**: "PRISM" / "Prism" / "Veevart" stay verbatim across locales.
- **Internal-team English terms preserved in Spanish**: `Workstream`, `Lead`, `Bug`, `Roadmap`, `Settings`, `issues`, `Markdown`, `Rationale`, `escalations`, `key`, `sync`, `PoD`, `Provider`, `cross-team`. These are how the team speaks internally; translating them would make the UI feel foreign to the very users we're building for.
- **Native date / time picker chrome**: HeroUI's `DatePicker` / `DateRangePicker` route through React Aria's locale-aware composition, so the UI auto-localizes via the `NextIntlClientProvider`. No per-field work needed.

#### Adding a new locale

1. Add the code to `routing.locales` in `src/i18n/routing.ts`.
2. Create `messages/<code>/{common,auth,topbar,projects,projectDetail,narratives,preview,errors}.json`.
3. Add a per-locale option in `topbar.languageSwitcher.options` (in EVERY existing locale's `topbar.json`).
4. The middleware + layout + LanguageSwitcher pick it up automatically because they iterate `routing.locales`.

Out of scope without product asking: any locale beyond en / es.

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
  `text-*` utility, opacity overridable via `className`. Default
  opacity baked at 0.08. Used in the `/projects` topbar hero —
  reads as movement / continuity (many threads moving forward).
- **`NarrativePattern`** (iter 4h R4, in `Decorative.tsx`) — 4
  concentric quarter-circle arcs anchored at the top-right corner
  of a 600×400 viewBox (radii 120 / 240 / 360 / 480), same
  `preserveAspectRatio` + `non-scaling-stroke` posture. **No baked
  opacity** (consumer-driven via className) — the public preview
  needs `opacity-[0.06]` normal → `opacity-[0.04]` presentation, and
  baking a default would make the override unpredictable through
  Tailwind's utility ordering. Used in the `/preview` wrapper —
  reads as broadcast / amplification (the narrative shared
  outward to audiences). Distinct visual voice from CurvedLines so
  the two surfaces don't feel like reskins of each other.

#### `in_progress` lavender (preview) vs blue (roadmap) asymmetry

The operational roadmap at `/projects/[key]?view=roadmap` renders
in-progress Jira epics in BLUE (`bg-info-bg` track + `bg-info`
overlay), while the public narrative preview at
`/projects/[key]/narratives/[id]/preview` renders in-progress phases
and workstreams in LAVENDER (`bg-primary-500` /
`text-primary-700` / `border-l-primary-500`).

This is INTENTIONAL, not a drift to consolidate. Different
audiences, different metaphors:

- **Roadmap is OPERATIONAL.** PMs scan execution by the dozen;
  lavender on every active row would blur into brand identity and
  stop reading as a status signal. Blue stays distinct from the
  Prism palette and reads as "live work" without competing with
  the brand.
- **Preview is PRESENTATIONAL.** Stakeholders / C-level read a
  single live narrative; lavender ties the active phase visually
  to the Prism brand and communicates vitality coherent with the
  product identity.

Both surfaces use the same `--color-info` and `--color-primary-*`
tokens — the asymmetry is in *application*, not in token values.
Block comments preserve the design intent at:

- `src/components/narrative-public/PhaseSection.tsx` — STATUS_PALETTE
- `src/components/narrative-public/WorkstreamCard.tsx` — ProgressBadge

If a future refactor proposes to consolidate "for consistency", the
above is why the two surfaces diverge — keep them divergent.

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

1. `runSync({ triggeredBy })` opens a `sync_runs` row with `status='running'` + `triggered_by` ('manual' | 'cron').
2. `syncProjects(jira)` upserts every project from `listProjects()` into `projects`. **A failure here aborts the run pre-loop** (status='failed', no per-project detail).
3. For each project: `syncIssuesForProject(jira, key)` **wrapped in its own try/catch** (iter 6):
   - On success: stats accumulate, `successCount++`.
   - On failure: `{ projectKey, error }` lands in `failedProjects[]` and the loop **continues** with the next key. One project's Jira hiccup no longer aborts the whole run.
   - Per-project work itself: watermark = `projects.last_synced_at - 1 day` (date-only, JQL TZ buffer), stream pages via `searchIssuesPaginated` (cursor: `nextPageToken`; legacy `/rest/api/3/search` was removed by Atlassian May 2025), upsert issues with `parent_id=null` then backfill `parent_id` in a second pass (avoids self-FK violations when parent+child arrive in the same upsert batch), upsert `issue_links` by `(source_issue_id, target_issue_key, link_type)` with nullable `target_issue_id` for cross-project links, run `detectDeletedIssues(project.id, syncedKeys, supabase)` **only when `isFull === true`** (iter 9a — the incremental path can't observe absence safely), update `projects.last_synced_at`.
4. **Aggregate status decision** (iter 6):
   - `failedProjects.length === 0` → `'success'` → `succeedRun()` → HTTP 200.
   - `successCount === 0 && failedProjects.length > 0` → `'failed'` → `failRun()` with summary message + per-project detail → HTTP 500.
   - Otherwise (mixed) → `'partial'` → `partialRun()` writes summary + `failed_projects` JSONB → HTTP 200.
   - Top-level catch (`syncProjects` failed, `JiraClient` ctor failed, etc.) → `'failed'` with `failed_projects = NULL` (the loop never ran).
5. Aggregated stats (`issuesCreated`, `issuesUpdated`, `linksSkipped`, plus `issuesMarkedDeleted` / `issuesRestoredFromDeleted` from iter 9a) reflect ONLY successful projects. A partial run's stats are the truthful subset, not the wished-for total. `issuesMarkedDeleted` is also persisted to `sync_runs.issues_deleted` (column existed since iter 1, only started being written in iter 9a).
6. Structured logs throughout: `[sync] runId=N triggeredBy=cron type=incremental projects=5`, `[sync] runId=N project=NOXSCRUM ok created=12 updated=3`, `[sync] runId=N project=REN failed error="..."`, `[sync] runId=N done status=partial success=4 failed=1 durationMs=23456`. The per-project `ok` line and the final `done` line append ` markedDeleted=X restoredFromDeleted=Y` when non-zero (iter 9a — suffix omitted on incremental runs and on full runs with no deletion events, so incremental logs stay tidy). Greppable in Vercel logs.

### Cron sync (iter 6)

Daily automated Jira sync via Vercel Cron on the Hobby plan. Manual sync via the `/projects` Hero `SyncButton` keeps working unchanged.

#### Architecture

- **`vercel.json`** at repo root declares one cron entry hitting `GET /api/cron/sync-jira` at `0 6 * * *` (06:00 UTC). Hobby plan caps cron entries at 2; we use 1, leaving room for one future scheduled job.
- **`/api/cron/sync-jira/route.ts`** — GET handler invoked by Vercel Cron. Verifies `Authorization: Bearer ${CRON_SECRET}` (Vercel attaches the bearer header automatically on cron-driven calls) using `timingSafeEqual` from `node:crypto`. Calls `runSync({ triggeredBy: 'cron', type: 'full' })` directly — NOT a self-fetch to `/api/sync`. Reasons: one serverless function counts against budgets (not two stacked); the 60s Hobby budget is one budget, not two; no network round-trip / DNS / TLS for a same-process call; no need for `SYNC_SECRET` in the cron path. **`type: 'full'` is iter-9c-load-bearing**: iter 9a's tombstone detection in `syncIssuesForProject` gates to `isFull === true` because incremental returns the watermark slice and can't observe absence. Without forcing full here the daily cron — the only automated trigger — could never detect a Jira-side deletion, and the manual Hero button is also incremental. `maxDuration = 60` (Hobby cap; full sync today lands ~25-40s for ~5 projects, leaving 20s+ headroom; revisit if a tenant grows past that).
- **Status code mapping** (cron route + `/api/sync`): `'success'` or `'partial'` → 200, `'failed'` → 500. Vercel logs reflect HTTP status, so a partial run shows green in the dashboard but the `SyncStatusBadge` still surfaces it on `/projects`.
- **Middleware allow-list**: `src/middleware.ts` step 1 already bypasses `/api/cron/*` from auth gating, so the cron route doesn't need a Supabase session.

#### Schedule rationale

`0 6 * * *` = 06:00 UTC = 01:00 Colombia (UTC-5) / 03:00 Argentina (UTC-3). Both are well past midnight in any LATAM timezone — a 60s lock-in won't pinch anyone working. Worst case the run finishes ~07:00 UTC = 02:00 CO / 04:00 AR, still pre-workday everywhere we operate. Vercel valley hours (lower latency on shared compute) is a bonus.

If product asks for fresher data closer to the LATAM workday, change one line in `vercel.json` (e.g. `0 11 * * *` = 06:00 CO).

#### Per-project resilience contract

A run with 5 projects where REN fails mid-loop:
- The other 4 still upsert their issues and links.
- REN's row in `failed_projects` JSONB carries `{ projectKey: "REN", error: "<describeError output>" }`.
- `sync_runs.status = 'partial'`, `sync_runs.error_message = "1 project failed: REN"`.
- HTTP 200 (some progress made).
- `SyncStatusBadge` on `/projects` Hero surfaces "Sync parcial · 1 proyecto falló" with a Popover detailing REN's error.

If ALL 5 projects fail in the loop:
- `failed_projects` carries all 5 entries.
- `sync_runs.status = 'failed'`, `sync_runs.error_message = "All 5 projects failed: A, B, C, D, E"`.
- HTTP 500.
- Badge surfaces "Sync falló · Todos los proyectos fallaron" with Popover detailing each error.

If `syncProjects()` itself fails (Jira auth, network):
- The loop never runs. `failed_projects = NULL`, `error_message` carries the top-level error.
- `sync_runs.status = 'failed'`, HTTP 500.
- Badge surfaces "Sync falló" with Popover showing only the `error_message` (no per-project list).

#### Manual vs cron distinction

- Hero `SyncButton` → Server Action `triggerSync()` → `runSync({ triggeredBy: 'manual' })`. **No `type` passed**, so it defaults to incremental — the manual button stays fast (PMs are watching it spin) but does NOT detect Jira-side deletions. The 06:00 UTC cron is what catches deletions; PMs who can't wait can `curl` with `{"type":"full","projectKey":"X"}`.
- `POST /api/sync` (curl / ops) → hardcodes `triggeredBy: 'manual'`. The body now accepts only `{ type, projectKey }`; `triggeredBy` is not user-overridable from HTTP. Power-user workaround for "I just deleted in Jira, surface it now": pass `{"type":"full","projectKey":"<KEY>"}` to trigger full sync of one project and fire the tombstone detector.
- `GET /api/cron/sync-jira` → `runSync({ triggeredBy: 'cron', type: 'full' })` (iter 9c — full is required so the tombstone detector can run; see route handler comment for the contract).

`sync_runs.triggered_by` defaults to `'manual'` so all historical rows from before iter 6 keep the right truth (manual was the only path).

#### `SyncStatusBadge` on `/projects`

Rendered inline below the Hero subtitle when the most recent finished run was partial or failed. Returns null on clean success or no-run-yet, so the happy-path layout is unchanged.

The page loader runs **two `sync_runs` queries in parallel**:
- `lastSuccessfulSync` (`status='success'`, ORDER BY finished_at DESC LIMIT 1) — drives the Hero subtitle "Last sync: 1 day ago". Stable; only moves on clean runs.
- `lastRun` (`status IN ('success', 'partial', 'failed')`, ORDER BY finished_at DESC NULLS LAST LIMIT 1) — drives the badge. Excludes `'running'` to dodge stuck rows.

Two separate queries (vs. one fetched-and-massaged) because each composes its own `ORDER BY finished_at DESC LIMIT 1` on the same indexed column; PostgREST can't express "give me the latest of each status" in a single round-trip without an SQL function. Cheap.

The badge component is a HeroUI Popover wrapping a chip-styled `<button>`. Click opens the Popover with: summary line ("N projects failed" or "All projects failed"), run id, trigger source ("Triggered by cron" / "Triggered manually"), and per-project error rows. i18n keys live under `projects.syncBadge.*` with separate `ariaTrigger.*` strings so screen-readers narrate context + action in one phrase.

#### Post-deploy verification

After merging:
1. **Manual probe**: `curl -H "Authorization: Bearer $CRON_SECRET" https://<deploy>/api/cron/sync-jira` should return 200 with the run result. Without the header → 401.
2. **Wait 24h**: first scheduled run lands at the next 06:00 UTC.
3. **Vercel dashboard → Cron Jobs → Logs**: confirm the cron triggered at the expected time, status 200, duration <60s. Structured log lines (`[cron] sync-jira completed status=… runId=…`) make the run easy to locate.
4. **`/projects`**: the Hero subtitle updates ("hace pocas horas"), the badge stays hidden if the run was clean, surfaces partial/failed otherwise.
5. **Manual sync via the Hero button** keeps writing rows with `triggered_by='manual'` for split-by-source observability.

#### Limitations / TODOs

- **No queue / no parallel project fetches**. The loop is sequential; ~5 projects fit comfortably in the 60s budget. If Jira slows down or project count grows past ~10, switch to bounded `Promise.all` parallelism (3-5 concurrent `syncIssuesForProject`) before considering a queue.
- **No notifications**. Partial / failed runs surface only on the dashboard badge + Vercel logs. Email / Slack alerts deliberately deferred — too noisy at the current Hobby cadence (1/day) and the badge already gives the next visitor immediate context.
- **No retry**. A failed project fails for the whole day. The next 06:00 UTC run gets a fresh attempt. If the failure is sticky, the badge persists across days until someone manually triggers a sync after fixing the upstream issue.
- **`maxDuration = 60` is the Hobby ceiling**. If sync ever blows past it we'll see Vercel terminate the function; the next run on the next day attempts again. Long-term fix: parallelise Jira fetches first, queue (Inngest / Trigger.dev) only if parallelism isn't enough.

### AI assist (iter 7)

First AI capability: workstream description generate / refine. Foundation for future assists (generate phase, detect dependencies, etc. — out of iter 7 scope).

#### Architecture

- **`vercel.json`** unchanged; AI is request-driven, not scheduled.
- **`src/app/api/ai/workstream-description/route.ts`** — POST + SSE. Auth via `getServerSupabase().getUser()` (returns 401 if no session). Validates body shape (`workstreamId`, `narrativeId`, `issueKeys[]`, `currentText?`, `locale`). Fetches issues by key via admin client (RLS bypass — safe because issues table is fully readable to `authenticated`). 404 + logged ai_usage row if 0 issues match. Operation derived from `currentText.trim().length > 0` (refine vs generate). Streaming via `client.messages.stream(...)` with `request.signal` wired so client abort propagates cleanly. Three SSE event types: `chunk`, `done` (with usage + cost), `error` (with `errorCode`). `maxDuration = 60` (Hobby ceiling).
- **`src/middleware.ts`** allow-lists `/api/ai/*` in step 1 alongside `/api/sync` and `/api/cron/*`. Without that, intl middleware would redirect to `/<locale>/api/ai/...` and 404.
- **`src/lib/ai/`** modules: `client.ts` (lazy + cached Anthropic client; throws on missing `ANTHROPIC_API_KEY` at first call, NOT module load), `prompts/workstream-description.ts` (pure prompt builders + 200-char summary truncation), `actions/workstream-description.ts` (non-streaming runner — testable in isolation, not currently wired), `usage/pricing.ts` (cost computation; constants verified against anthropic.com/pricing on 2026-05-07), `usage/log.ts` (admin-client INSERT into `ai_usage`; logs failures to console without throwing — losing one audit row beats failing a successful AI op), `error-codes.ts` (shared `AIErrorCode` union: `config | rate | service | timeout | generic`).
- **Client hook** `src/components/narrative-editor/useWorkstreamDescriptionAI.ts`: state machine (`idle | streaming | error`), one in-flight stream per instance, `AbortController` cleanup on unmount, `fetch + ReadableStream + getReader()` consumer with `data: <json>\n\n` SSE frame parser. Two error mappers — `mapHttpStatus` for pre-stream HTTP failures, `mapErrorCode` for in-stream SSE error frames. Both converge to a translated message in `errorMessage` state. Stream-closed-early detection (reader exits without terminal frame → `'timeout'` error, treats Vercel function termination gracefully).
- **UI surfaces** in the narrative editor:
  - `WorkstreamForm.tsx` button next to the description label. State derived from `hasIssues + isDescriptionEmpty`: `'disabled'` (button shown grayed + tooltip "Link issues to use AI assistance"), `'generate'` (label "Generate with AI"), `'refine'` (label "Refine with AI"). `operationInFlight` snapshot at click time so the "Generating…" label doesn't flip mid-stream when chunks arrive and the field stops being empty.
  - `AIRefineModal.tsx` — HeroUI Modal split-grid (original ↔ refined). Auto-starts streaming on open via `useEffect([isOpen])`; cleanup aborts in-flight request. Three actions: Keep original (close, no apply), Refine again (re-run with `originalText` — NOT compounding from the previous refined output), Use refined version (apply trimmed text + close).

#### Generate vs Refine UX

- **Generate**: button visible when description is empty + workstream has issues. Click → clear field → stream chunks straight into `draft.description`. The auto-save hook persists on debounce. Textarea is `disabled` while streaming so the user can't type into the middle of an AI write.
- **Refine**: button visible when description has content + workstream has issues. Click → opens `AIRefineModal`. The modal owns its own streaming state and acceptance flow; the form's description field doesn't update until the user clicks "Use refined version".
- **Disabled** (no issues): button shown grayed with tooltip explaining why. Click is a no-op. Once the user adds issues via `JiraIssueKeysInput`, the state derives to `'generate'` automatically.

#### Cancellation contract

- **Cancellations DO incur partial costs.** Anthropic bills for input tokens immediately on prompt receipt and for output tokens already streamed before the abort propagates. `cost_usd` on `ai_usage` rows with `status='cancelled'` is typically non-zero and reflects what we'd pay even though the user never saw the full output.
- **Why this matters**: a UX pattern that auto-cancels on every keystroke would be more expensive than a manual click-to-generate even if the user always cancels. Today our cancellation triggers are coarse (modal close, navigation, explicit abort) — fine. Don't add fine-grained cancellation triggers without reconsidering cost.
- **Logging on cancel**: the route handler catches the abort, marks the SDK error as `AbortError` by name, and writes `ai_usage` with `status='cancelled'`, partial output preserved, partial token counts captured from `message_start` / `message_delta` events received before the abort.

#### Audit log (`ai_usage`)

Migration `20260507194722_add_ai_usage_table.sql`. Per-row columns: `id` UUID, `user_id` (FK auth.users CASCADE) + `user_email` denormalized, `operation` (CHECK enum: `generate_workstream_description | refine_workstream_description`), `workstream_id` + `narrative_id` (both nullable + ON DELETE SET NULL so audit rows survive entity deletion), `input` JSONB (per-op shape in column COMMENT), `output` TEXT, token counts + `cost_usd` DECIMAL(10,6) + `duration_ms` (all nullable + non-negative CHECKs), `status` CHECK enum (`success | error | cancelled`), `error_message`, `created_at`.

RLS: `ai_usage_self_read` policy with `(SELECT auth.uid())` wrapper (Supabase performance pattern — one-time evaluation per query). No INSERT/UPDATE/DELETE policies for `authenticated`; service-role bypass for writes from Server Actions / route handler. The audit log is immutable from the application's perspective.

Indexes: `(user_id, created_at DESC)` (workhorse for "show me my recent usage"), `operation` (per-op analytics), `status` (debug filter).

`user_email` is **truth-in-moment**: a denormalized snapshot of the user's email at write time. If a user changes their email later, historical rows keep showing the email of when the row was written. Acceptable for an audit log — matches how sync_runs records `error_message` at the moment of failure rather than tracking it forward.

#### Summary truncation (200 chars)

`prompts/workstream-description.ts` truncates each issue summary to 200 chars before composing the prompt. Trade-off: 10 issues × full Jira summary (often 200-400 chars) would push the prompt past 3000 input tokens for context that's mostly redundant. 200 chars per summary keeps cost predictable (typical request lands ~500 input tokens, ~75 output → ~$0.001) while preserving enough signal for the model to synthesize.

If a future workstream's prompt quality suffers because the truncation cuts mid-thought, evaluate either: (a) extend to 400 chars, (b) extract `description` from `issues.raw` jsonb, (c) call `tools.use` with a `getIssueDetails` tool for in-context lookup. Today's quality is "good enough on NOXSCRUM-like inputs" per iter 7 manual validation — gather PM feedback before raising the cap.

#### Pricing + cost model

`src/lib/ai/usage/pricing.ts` constants: `INPUT_USD_PER_MTOK = 1.0`, `OUTPUT_USD_PER_MTOK = 5.0` for `claude-haiku-4-5-20251001`. **Verified against anthropic.com/pricing on 2026-05-07.** To update: re-check pricing page, change constants, bump the verified date in the comment. Historical `ai_usage` rows stay at their old `cost_usd` values — that's correct: the audit log records what was charged at write time.

`computeCostUsd({ inputTokens, outputTokens })` rounds to 6 decimals to land cleanly in `DECIMAL(10, 6)` (avoids JS float artifacts like `0.0000010000000000000002`).

#### Error classification end-to-end

Two parallel paths into the user-facing error message:

- **Pre-stream HTTP** (auth gate, validation, fetch failures): route handler returns JSON with HTTP status. Client `mapHttpStatus`: 401 → `unauthorized`, 404 → `issuesNotFound`, 429 → `rateLimited`, 5xx → `serviceUnavailable`, default → `generic`.
- **In-stream SSE error frame**: route handler's `classifyAnthropicError(e)` derives an `AIErrorCode` from the SDK error: 401/403 → `config` (key invalid / permission), 429 → `rate`, 5xx → `service`, `APIConnectionError` → `service`, `APIConnectionTimeoutError` → `timeout`, else → `generic`. Frame payload: `{ type: "error", message, errorCode }`. Client `mapErrorCode` selects the localized string from `narratives.ai.errors.*`. The raw SDK message stops leaking to the user (it would expose internal SDK semantics).
- **Stream closed early**: reader exits without seeing a terminal frame → likely Vercel function timeout or upstream disconnect. Hook surfaces `tErrors("timeout")`: "Generation took too long. Try with fewer linked issues."

#### Future per-project membership consideration

Today every authenticated user can read every narrative + every issue. When per-project membership lands (CLAUDE.md TODO under iter 4f), `ai_usage` will need a review:
- A user's historical `ai_usage` rows might leak access patterns: their `summaries` JSONB caches issue summaries from a project they no longer have access to.
- Two options at that point: (a) cascade-delete `ai_usage` rows when a user loses access to the underlying project, (b) re-validate access at render time before showing the row's input. Decide then; today there's no problem because access is flat.

#### Adding a new AI operation (future iters)

1. Migrate `ai_usage.operation` CHECK to allow the new value (e.g. `'generate_phase'`). Deliberate friction — every new AI surface should be a conscious schema change.
2. Add prompt builder under `src/lib/ai/prompts/<operation>.ts`.
3. Add route handler under `src/app/api/ai/<operation>/route.ts` reusing the SSE framing pattern. The hook `useWorkstreamDescriptionAI` is operation-specific by name; either generalize it or write a sibling hook.
4. i18n strings under a sibling key (e.g. `narratives.ai.phaseGenerate.*`) — keep `ai.errors.*` shared.
5. Document the new surface in this section.

### Testing (iter 8)

First test surface lands. 61 tests, 5 files, ~250ms run.

#### Running tests

```bash
pnpm test              # one-shot (CI mode, exits 0/1)
pnpm test:watch        # interactive watch — dev default
pnpm test:ui           # vitest --ui browser-based UI
pnpm test -u           # update inline snapshots after intentional changes
```

`pnpm test -u` is the canonical workflow when prompt builders or other snapshotted output changes intentionally. Snapshot fails → `-u` to capture the new output → review the diff in PR. **Never `-u` without reading the diff** — that's how silent format regressions slip in.

#### Convention: co-located `.test.ts` files

Tests live next to source: `src/lib/sync/index.test.ts` is next to `src/lib/sync/index.ts`. Pros: refactors that move source files drag tests automatically, directory listings show coverage at a glance, no `tests/` indirection. Vitest picks up `src/**/*.{test,spec}.{ts,tsx}` from anywhere; no per-test config.

Inline snapshots (`.toMatchInlineSnapshot()`) are the default for prompt builder structural tests — keeps the snapshot in the test file alongside the assertion. No `.snap` sidecar files. Reviewers see the diff in the same file when the format drifts.

#### What's covered

| Surface | File | Coverage |
| --- | --- | --- |
| Smoke + i18n format helper | `src/lib/format/actor.test.ts` | 10 tests — locks the NULL / `"system"` / empty-string → translated System label contract |
| `runSync` decision tree (iter 6) | `src/lib/sync/index.test.ts` | 8 tests — `success` / `partial` / `failed` aggregate status, projectKey filter, stats accounting, `triggeredBy` stamping. Mocks `./runs` / `./projects` / `./issues` + JiraClient at the import boundary; doesn't touch Supabase or Jira. |
| `computeDerived` recursive progress + `deriveRiskLevel` (iter 4c-d) | `src/lib/narratives/derived.test.ts` | 20 tests — global progress aggregation (canonical "phase ≠ unit of weighting"), recursive closure, cycle protection, per-phase manual override + clamping, overdue counting, all 7 precedence rules of `deriveRiskLevel` |
| AI pricing (iter 7) | `src/lib/ai/usage/pricing.test.ts` | 7 tests — boundary token counts, mixed sums, 6-decimal rounding to land cleanly in DECIMAL(10,6) |
| AI prompt builders (iter 7) | `src/lib/ai/prompts/workstream-description.test.ts` | 16 tests — `truncateSummary` unit logic, inline snapshots of `buildGeneratePrompt` / `buildRefinePrompt`, contains-checks for SYSTEM_PROMPT v2 critical phrases |

#### What's NOT covered (deliberate, iter 8 scope decision)

- **UI components** with HeroUI / Tailwind. Snapshot-testing markup is high-maintenance, low-value at this stage. The visual surface is validated manually via `pnpm dev` and the canonical `/dev/components-preview` page.
- **Server Actions de mutación** (narrative create / update / delete, AI runner). Would require either a test DB or heavy Supabase mocking; ROI is low until a regression actually bites in production.
- **Hooks with SSE streaming** (`useWorkstreamDescriptionAI`). Testable but the setup (mock `fetch` + ReadableStream + AbortController parser) duplicates app complexity in test scaffolding.
- **E2E with Playwright**. Out of scope. The locale routing, auth gates, and editor flows would all need browser-driven tests; deferred until the test surface above stabilizes and a real regression motivates the cost.

The trade-off: high regression value on pure compute (decision trees, recursive math, pricing, prompt structure) for low test scaffolding cost. UI / mutation / E2E expand only when a specific bug class makes the test surface worth its weight.

#### Mock strategy: replace at the helper boundary, not at Supabase

`runSync` doesn't get tested with a fake supabase client. Instead, `vi.mock('./runs')`, `vi.mock('./projects')`, `vi.mock('./issues')`, and `vi.mock('@/lib/jira/client')` replace the helper modules. Reasons:
1. `runSync`'s job is the decision tree (success / partial / failed). The helpers' work is tested elsewhere — or isn't, for the inner sync loops, which are out of iter 8 scope.
2. Mocking supabase-js's fluent builder (`.from().select().eq().single()`) deep-down adds test scaffolding for behavior the test isn't about.
3. No DB / network in tests = fast (~250ms total), no env vars needed in CI.

`server-only` is stubbed via `resolve.alias` in `vitest.config.ts` pointing at `test-utils/server-only.ts` (an empty `export {}`). The real package throws on import to break client-component bundling — that guard is a false positive in Vitest's Node environment. Production bundling still uses the real package; the alias is scoped to Vitest only.

#### CI gate

`.github/workflows/ci.yml`. Triggers on push to main and pull_request to main. Single job: lint → typecheck → test. Concurrency group cancels superseded runs on the same ref. Install uses `--frozen-lockfile` so a lockfile drift fails CI loudly. No secrets — every test mocks at the module boundary.

If a future test needs a real service (live Supabase, real Anthropic API for prompt evaluation), add the secret here and document it.

#### React 19 hook lint deuda (deferred, post-iter-8)

Nine sites carry `eslint-disable-next-line` (or block) for `react-hooks/set-state-in-effect` (6) and `react-hooks/refs` (3). All three are React 19 best-practice rules; the patterns are legitimate but suboptimal. Per-site reasons + cleanup recipe live at the disable line. Inventory:

| Site | Rule | Pattern | Cleanup recipe |
| --- | --- | --- | --- |
| `narrative-editor/AIRefineModal.tsx:55` | set-state-in-effect | reset prior refined text on modal reopen | use a `key` prop on the modal so React unmounts + remounts and the state initializer handles the reset |
| `narrative-editor/JiraIssueKeysInput.tsx:56` | set-state-in-effect | sync resolved provider id back to null when prop clears | derive via `useSyncExternalStore` over the in-memory cache |
| `narrative-editor/JiraIssueKeysInput.tsx:144` | set-state-in-effect | clear suggestions / loading flag on empty query (debounce reset) | derive `suggestions` via `useMemo` returning `[]` for empty query, fold the search into a `useEffectEvent` |
| `narrative-editor/PodAutocompleteInput.tsx:41` | set-state-in-effect | mirror controlled input value when `pod` prop changes | lift to fully uncontrolled + parent-driven, or `useImperativeHandle` reset trigger |
| `narrative-editor/PodAutocompleteInput.tsx:47` | set-state-in-effect | clear suggestions on empty query (mirrors JiraIssueKeysInput) | same recipe as JiraIssueKeysInput:144 |
| `project/IssueDrawer.tsx:53` | set-state-in-effect | clear drawer detail when issue selection clears | derive `detail` from `issue` via `useDeferredValue` + a lazy fetcher pattern |
| `narrative-editor/useAutoSave.ts:51-53` | refs | latest-value ref pattern for stable autosave callbacks | revisit when `useEffectEvent` ships stable; deps-tracked closures complicate the synchronous flush() timing |

Cleanup is incremental — when refactoring any of these files for product reasons, take the cleanup path at the same time and remove the disable. **Do not batch a "fix all 9" iter** without a concrete React 19 strict-mode reason. The disables are safe; the rules are aspirational best-practice, not bug catches (the one real bug — `rules-of-hooks` in `ProjectRoadmap.tsx` — was fixed pre-iter-8 in its own commit).

### Soft delete (iter 9a)

Tombstone-based detection of issues deleted in Jira upstream. `issues.deleted_at TIMESTAMPTZ DEFAULT NULL` plus a partial index on `(deleted_at) WHERE deleted_at IS NOT NULL`. The schema is non-cascading by design — deleting an issue in Jira marks it but doesn't propagate destructive actions in Prism (workstreams, dependencies, narratives keep their references; the UI surfaces the stale state instead of silently rewiring data).

#### Detection contract

`detectDeletedIssues(projectId, freshKeys, supabase)` lives in `src/lib/sync/detect-deleted.ts`. Pure function (well, two batched `UPDATE`s) that:

1. SELECTs `id, key, deleted_at` for every issue in `project_id`.
2. Walks the result. Keys in DB but missing from `freshKeys` AND not already tombstoned → batch 1 (`UPDATE issues SET deleted_at = NOW() WHERE id IN (...)`). Keys present in both AND currently tombstoned → batch 2 (`UPDATE issues SET deleted_at = NULL WHERE id IN (...)`).
3. Returns `{ markedDeleted: number, restoredFromDeleted: number }`.

No threshold or rollback. Bad-data windows (truncated Jira fetch the operator didn't notice, etc.) self-heal on the next successful full sync because tombstones are reversible.

The supabase client is passed as a parameter, not instantiated inside. This is the testability injection point — tests pass an in-memory fake of the fluent builder, production passes the admin client already in scope from `syncIssuesForProject`.

#### Ordering inside `syncIssuesForProject`

The call to `detectDeletedIssues` sits AFTER the page loop + parent backfill + link backfill, and BEFORE the `last_synced_at` stamp. Two reasons:

- **Post-upsert ordering**: a thrown error anywhere earlier in the per-project pipeline propagates before detection runs, so `deleted_at` is only ever mutated on a clean full sync. If Jira returned partial pages and the loop crashed mid-page, the issues that DID arrive are upserted but no key is yet marked deleted — the run lands in `partial` or `failed` state and the next attempt re-tries cleanly.
- **Pre-stamp ordering**: `last_synced_at` is the watermark. We only advance it after the full pipeline (including detection) succeeds.

#### The `isFull` gate

Detection runs ONLY when `isFull === true`:

```ts
if (isFull) {
  const result = await detectDeletedIssues(project.id, syncedKeys, supabase);
  issuesMarkedDeleted = result.markedDeleted;
  issuesRestoredFromDeleted = result.restoredFromDeleted;
}
```

The contract is load-bearing. Incremental syncs use the JQL filter `updated >= watermark`, so `syncedKeys` is just the slice that changed — absence does NOT imply deletion. Running detection there would tombstone every untouched-but-still-active issue, which the daily cron would then unmark, producing churn and incorrect `deleted_at` timestamps. **Never invoke `detectDeletedIssues` from an incremental code path.** If a future incremental optimization needs deletion awareness, the right move is to add a separate "is-this-key-still-in-Jira?" probe scoped to a tiny set — not to repurpose `detectDeletedIssues`.

#### Aggregation coherence

A second migration (`20260511153148_filter_deleted_from_aggregations.sql`) updates the two operational aggregation surfaces so tombstones don't inflate counts:

- **`project_dashboard()` RPC** — `AND deleted_at IS NULL` in `issue_stats` CTE (drives total / todo / in_progress / done / overdue counts) and `blocked_stats` CTE (drives blocked count).
- **`project_stats` view** — `COUNT(i.id) FILTER (WHERE i.deleted_at IS NULL)` for `total_issues`, same filter PLUS `status_category = 'Done'` for `done_issues`. FILTER over the JOIN rather than moving the predicate into the ON clause so projects with ONLY deleted issues still appear as a row (with `total_issues = 0`).

Both surfaces share the issue table and the dashboard read; without this migration the KPI header would have shown "Total: 813" while ProjectTable rendered 810 active rows, breaking the trust we built in the "is this project on time?" framing.

#### UI surfaces and visual contract

- **`ProjectTable`** (`/projects/[key]?view=list`): third filter Toggle "Show deleted" / "Mostrar borradas", default OFF, **only rendered when `rows.some(r => r.deleted_at !== null)`** (absence is the information). Deleted rows render `opacity-60` on the `<tr>` + `line-through` on the summary span + a `Trash2` icon between the issue type icon and the key, wrapped in a `<span title>` because Lucide icons don't surface `title` as a prop. The `StatusChip` is intentionally preserved — it shows the last-known status before deletion, which is more useful than wiping it.

- **`ProjectRoadmap`** (`/projects/[key]?view=roadmap`): no toggle. Tombstones are filtered at the entry-point `activeRows` useMemo so every downstream computation (`allEpics`, `allPlanned`, `unplannedCount`, `UnplannedSection`) agrees that the roadmap is a planning surface where deleted work has no place. Divergence F from the original iter-9 spec, accepted: a deleted epic on a roadmap is misleading, and adding a toggle wouldn't have a real use case.

- **`narrative-public/IssueChip`**: third variant after "found" and "missing-from-sync". `opacity-70` row + `line-through` on key + `line-through` on summary + `Trash2` next to type icon + tooltip "Deleted in Jira on {date}". Status chip preserved, **Jira link intentionally dropped** — the page upstream no longer exists, so a hyperlink would lead to a 404.

- **`WorkstreamCard.CountsRow`** (public): appends "N deleted" to the inline `parts` array when `deletedKeys.length > 0`. Sits between "issues" and "overdue", surfacing the intent that "this workstream listed 5 keys, but 1 was deleted upstream".

- **`DependencyCard.ProviderBlock`** (public): surfaces "N deleted" alongside the existing "N not synced" counter in neutral `text-muted` tone. The dependency's `aggregateProgress` excludes deleted from the denominator — a tombstoned provider issue can't distort the risk picture.

- **`JiraIssueKeysInput`** (editor): autocomplete query gains `.is("deleted_at", null)` so deleted issues never appear as suggestions. The hydration query **intentionally skips this filter** so already-linked deleted chips render with the tombstone variant (Trash2 + line-through + tooltip with the deletion date). The remove (X) button stays so the PM can clear the dead reference; the Jira link is dropped.

#### Derived computation (3-bucket pattern)

`src/lib/narratives/derived.ts` treats deleted as a third bucket parallel to found / missing:

- **`WorkstreamDerived`** gains `deletedKeys: string[]` — disjoint from `missingKeys`. Deleted ≠ never-synced; the UI surfaces them differently.
- **`ProviderIssuesData`** gains `deleted: IssuePublicData[]` — also disjoint from `missing: string[]` (just keys) and `found: IssuePublicData[]`.
- **`computeWorkstream`** classifies into 3 buckets in one pass. Only the "active" bucket contributes to `byCategory`, `overdueCount`, `linked`, and `progress`. Missing keys go to `missingKeys`; tombstoned ones go to `deletedKeys`.
- **`computeIssueProgress`** filters deleted children before recursing. A parent whose only loaded children are tombstoned reverts to leaf treatment based on its own status — the most honest fallback when the descendant graph dies upstream.
- **`countUniqueFoundIssues`** (global header total) skips deleted from the unique-keys union across workstreams.

When extending the derived layer (new aggregations, new bucket types), keep the 3-bucket discipline: never collapse "deleted" into "missing" — they're informationally distinct and the UI conventions depend on the split.

#### Restoration semantics

If a Jira admin restores an issue upstream (uses Jira's "undelete" or otherwise the key reappears in a fetch), Prism auto-restores `deleted_at` to NULL on the next successful full sync. The tombstone is fully reversible at the data layer.

**Restoration does NOT propagate to derived state** — workstreams / dependencies that referenced the issue when it was tombstoned keep their references (they never dropped them). The next render simply observes `deleted_at IS NULL` and treats the key as active again. From the PM's perspective: the chip flips from "tombstoned" back to "active" automatically; counters re-include the issue; progress recomputes.

#### Limitations / TODO

- **No manual purge UI.** Tombstoned issues live in the DB forever. Acceptable while issue counts are low (NOXSCRUM is ~813); when a project's tombstones become a meaningful portion of the row count, consider either (a) a periodic vacuum that hard-deletes rows tombstoned > N days, or (b) an admin "purge" Server Action. Not implemented today.
- **No tombstone history.** `deleted_at` only records the latest detection event. If an issue gets deleted, restored, deleted again, all we have is the latest `deleted_at` value (NULL or the second deletion). A `deleted_history` audit table would surface the flapping; not needed yet.
- **`issue_links` keep pointing at tombstoned `source_issue_id` / `target_issue_id`.** The links table doesn't cascade or filter on deleted_at; consumers (drawer, blocked_stats CTE) filter at query time. Acceptable because the drawer already lazily fetches and surfaces missing-from-sync; if a future surface needs cleaner data, filter at the read.
- **Cross-project dependencies referencing deleted provider issues.** `narrative_dependencies.provider_jira_issue_keys` is TEXT[], no FK. A deleted provider issue surfaces correctly via the 3-bucket pattern, but the PM has no automatic prompt to update the dependency. Manual review remains the workflow.
- **`Set` ordering for `deletedKeys`** is insertion order from the iteration over `ws.jira_issue_keys`, which matches the order the PM typed them. Stable, but if a future UI needs alphabetical order or "newest first" surfacing, sort at render.

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
- **i18n hooks (post-iter 5)**: `useTranslations` / `useFormatter` are Client-only React hooks; `getTranslations` / `getFormatter` are Server-only async functions. A "leaf" component without `"use client"` that calls `useTranslations` becomes implicitly client when its consumer is client — fine when every consumer is client (`IssueChip`, `CommitmentStatusChip`, `DateGapIndicator`), broken if a Server Component tries to render it. Mark these "use client" explicitly so the boundary is loud, and document the consumer set in a top-of-file comment. Prefer `getTranslations` for components only ever rendered from Server (`SeverityBadge`, `RiskCard`, `DraftBanner`, etc.).

### Database

Schemas spread across the `supabase/migrations/` timeline. Tables:

**Jira sync (init migration `20260501113500_init_jira_dashboard_schema.sql`)**

- `projects` — PK = Jira project id (TEXT), unique `key`, lead, `raw` jsonb, `last_synced_at`.
- `issues` — PK = Jira issue id (TEXT), unique `key`, `project_id` FK CASCADE, `status_category` CHECK ('To Do' | 'In Progress' | 'Done'), `parent_id` self-FK SET NULL, `due_date`, `start_date`, jira+local timestamps, `raw` jsonb, `deleted_at` TIMESTAMPTZ NULL (iter 9a — tombstone set by `detectDeletedIssues` on full syncs when a key is no longer returned by Jira; auto-restored to NULL when the key reappears). Partial index `issues_deleted_at_idx ON issues(deleted_at) WHERE deleted_at IS NOT NULL`.
- `issue_links` — BIGINT identity PK, `source_issue_id` FK, `target_issue_id` nullable FK, `target_issue_key` NOT NULL, unique on `(source, target_key, link_type)`.
- `sync_runs` — `status` running/success/failed/**partial** (extended iter 6), `sync_type` full/incremental, `project_key` (NULL = all), `triggered_by` ('manual' | 'cron') (iter 6), `failed_projects` JSONB (iter 6: array of `{projectKey, error}`, NULL on clean success), stats counters, `jql_used`, `error_message`.

**Narratives (migration `20260504184656_add_narratives_schema.sql`, extended by 4d / 4e)**

- `project_narratives` — UUID PK, `project_id` TEXT FK CASCADE to `projects(id)`, `title`, `subtitle`, `overview`, `status_summary`, `risks_section_subtitle` (iter 4e — optional sub-heading for the public risks section, NULL = heading only), `published` BOOL, `created_by` / `updated_by` placeholders (auth not yet). Multiple narratives per project allowed by design (board-version vs customer-version). **Counter columns** `next_risk_id INT NOT NULL DEFAULT 1` and `next_dependency_id INT NOT NULL DEFAULT 1` (iter 4e) back the identifier-claim RPCs and never decrease — see "Stable identifiers" below.
- `narrative_phases` — UUID PK, `narrative_id` FK CASCADE, `order_index`, `name`, `objective`, `rationale`, `status` CHECK ('completed' | 'in_progress' | 'upcoming' | 'at_risk'), `progress_percent` 0-100 nullable, `start_date <= end_date` CHECK. Composite `UNIQUE (id, narrative_id)` exists to back the workstream FK below.
- `narrative_workstreams` — UUID PK, `narrative_id` FK CASCADE, **`phase_id` nullable** + composite FK `(phase_id, narrative_id) → narrative_phases(id, narrative_id)` ON DELETE CASCADE. NULL `phase_id` = orphan workstream rendered at the narrative root, beside phases. `jira_issue_keys TEXT[]` indexed via GIN — references issues by key only, no FK (live data still comes from `issues`).
- `narrative_risks` (iter 4e) — UUID PK, `narrative_id` FK CASCADE, `identifier TEXT NOT NULL CHECK (identifier ~ '^R\d+$') UNIQUE per narrative, `title`, `description`, `severity` CHECK in (low / medium / high), `impacts TEXT[] NOT NULL DEFAULT '{}'`, `mitigations TEXT[] NOT NULL DEFAULT '{}'`, both with `cardinality(arr) >= 1` CHECK (see "array_length vs cardinality" below). `related_dependency_ids UUID[] NOT NULL DEFAULT '{}'` indexed via GIN — Postgres can't FK array elements, so dangling refs (after a dep delete) are filtered at render time. `order_index INT NOT NULL`.

**Auth (migration `20260505145650_add_user_profiles_and_grant_rpc_to_authenticated.sql`, iter 4f Migration A)**

- `user_profiles` — UUID PK = `auth.users(id)` ON DELETE CASCADE, unique `email`, `display_name`, `jira_account_id` (cached on first login), `jira_verified_at`. Auto-created via the `on_auth_user_created` trigger (`SECURITY DEFINER` + `SET search_path = public`). RLS: `user_profiles_self_read` + `user_profiles_self_update` only — INSERT goes through the trigger's bypass, DELETE via cascade.

**AI assist (migration `20260507194722_add_ai_usage_table.sql`, iter 7)**

- `ai_usage` — UUID PK, `user_id` FK auth.users CASCADE + `user_email` denormalized (truth-in-moment audit snapshot), `operation` CHECK enum (`generate_workstream_description | refine_workstream_description`), `workstream_id` + `narrative_id` both nullable + ON DELETE SET NULL, `input` JSONB (per-op shape in column COMMENT), `output` TEXT, `input_tokens` / `output_tokens` / `cost_usd` DECIMAL(10,6) / `duration_ms` (all nullable + non-negative CHECKs), `status` CHECK enum (`success | error | cancelled`), `error_message`, `created_at`. RLS: per-user self-read only; service_role bypass for writes; immutable from app POV (no UPDATE/DELETE policies). Indexes: `(user_id, created_at DESC)`, `operation`, `status`.

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
- **i18n (post-iter 5)**: every UI string goes through `useTranslations` / `getTranslations`; never hardcode a Spanish or English literal in a component. Date / relative-time formatting routes through `useFormatter` / `getFormatter`; `Intl.DateTimeFormat("es-AR")` is forbidden. Internal navigation uses `Link` / `useRouter` from `@/i18n/navigation`, NOT `next/link` / `next/navigation` — the locale prefix MUST follow the user. New copy follows the gated workflow: English JSON proposal → user review → Spanish together → only THEN apply to components. See "Internationalization (iter 5)" for the full contract.
- **Testing (post-iter 8)**: tests live co-located with source as `*.test.ts(x)`. Mock at the helper-module boundary (`vi.mock('./helper')`), NOT deep at Supabase / Jira. Run `pnpm test` before pushing — CI enforces. Inline snapshots for structural drift (prompt format, etc.); update intentional changes via `pnpm test -u` and review the diff in PR. New code that touches `src/lib/sync/*`, `src/lib/narratives/derived.ts`, `src/lib/ai/*` should land with corresponding tests; UI / mutation / E2E surfaces are deliberately out of scope until a regression motivates them. See "Testing (iter 8)" for the full contract.
- **AI assist (post-iter 7)**: every AI operation logs a row in `ai_usage` (immutable audit log). `src/lib/ai/` is server-only — never import its client / pricing / log helpers from a client component. The route handler at `/api/ai/<operation>` is the SSE endpoint pattern; the client hook is the SSE consumer pattern. Both follow the iter 7 conventions: classify Anthropic SDK errors via `AIErrorCode`, surface via SSE error frames with `errorCode`, map to localized i18n strings under `narratives.ai.errors.*` (or operation-specific siblings). Pricing constants in `src/lib/ai/usage/pricing.ts` get a `verified-on YYYY-MM-DD` comment; updating means re-checking anthropic.com/pricing + bumping the date. Cancellations DO incur partial costs — design UX accordingly.
- **Soft-delete (post-iter 9a)**: deleted issues are tombstoned (`issues.deleted_at`), not hard-deleted. Filter `deleted_at IS NULL` whenever the surface is "active operational state" (KPI counts, roadmap, autocomplete suggestions); keep tombstones visible when the surface is "what the PM said" (workstream chips, dependency provider, the optional ProjectTable filter). In the derived layer follow the **3-bucket pattern**: missing (never synced), deleted (tombstoned), found (active) are informationally distinct — never collapse deleted into missing. `detectDeletedIssues` runs ONLY in the full-sync branch of `syncIssuesForProject`; never invoke it from an incremental code path. See "Soft delete (iter 9a)" for the full contract.

## Known tech debt
- **Watermark uses a 1-day buffer (date-only)** to dodge JQL TZ ambiguity. Refine to a TZ-aware timestamp (using the token user's `/myself.timeZone`) when volume justifies it.
- **Stuck `running` rows in `sync_runs`.** When the dev server restarts (HMR, file save) mid-sync, the `runSync` `try/catch` never fires and the row stays `running` forever. Run `pnpm diag:runs:reap` to mark rows older than 5min as `failed`. Long-term fix: a periodic reaper or a NOTIFY-based heartbeat. Acceptable today as a manual recovery step.
- **`/projects/[key]` issues table is not virtualized.** Fine for the current scale (NOXSCRUM has ~813 issues, render is snappy). At ~2000+ rows, switch to a virtualized renderer or paginate server-side. The bucketize/filter passes are O(n); the cost is in the DOM.
- **`/projects/[key]` roadmap is not virtualized.** Designed for ~10x current scale (~270 epics). The chart renders one absolutely-positioned `<button>` per visible epic plus a couple of SVG lines per week — at 270 epics × month-ranged ranges that's ~300 DOM nodes, fine. At 2000+ epics consider virtualizing the chart body rows (the left label column would virtualize in lockstep) and pre-bucketing on the server.
- **Drawer link enrichment runs a second `in()` query** to fetch summary/status for linked targets. At ~10s of links per issue this is fine; consider a single SQL function with JOINs if drawers feel slow.
- **Tests cover pure libs only (post-iter 8).** UI components, Server Actions de mutación, hooks with SSE streaming, and Playwright E2E are deliberately out of scope. The trade-off: high regression value on decision trees / recursive math / pricing / prompt structure for low scaffolding cost. UI surfaces still need manual smoke testing via `pnpm dev` + the visual bench at `/dev/components-preview`. Expand the surface only when a real regression motivates the cost.
- **9 react-hooks lint sites have `eslint-disable-next-line` deuda (post-iter 8).** All sites are React 19 best-practice rules (`set-state-in-effect`, `refs`) on legitimate-but-suboptimal patterns. Each disable carries a per-site reason + cleanup recipe at the line. Cleanup is incremental — refactor files when there's a product reason and take the React 19 fix at the same time. Don't batch a dedicated cleanup iter without a concrete strict-mode bug. Full inventory in the "Testing (iter 8)" section above.
- **No realtime updates** — the page is a static-ish render until reload or a click on Resincronizar.
- **Server-thrown errors are not translated (iter 5).** UI fallbacks ARE; the underlying `Error.message` strings thrown from `src/lib/narratives/mutations.ts`, `src/lib/sync/*`, the Supabase client, etc. are still English-only. Translating them means routing every throw through a translator (or shipping error codes the UI maps locally). Substantial refactor — TODO.
- **`/preview` stays auth-walled (iter 5).** Tokenized public share links remain a future iteration; today the public preview is reachable only via the locale-prefixed authenticated URL. If a stakeholder needs the link, they need a Veevart account.
- **No `/login` language switcher.** Pre-auth users default to `defaultLocale: "en"` (or whatever `NEXT_LOCALE` cookie carries from a prior session). If a stakeholder lands cold and wants Spanish before signing in, they can only get it by manually editing the URL prefix today. Acceptable trade-off; revisit if reported.
- **No cron retry on per-project failure (iter 6).** A partial run today stays partial until either (a) the next 06:00 UTC run succeeds for that project, or (b) someone manually clicks "Resincronizar". No backoff, no second attempt within the day. Acceptable while sync is daily and the failure surface is small (badge + logs). Revisit if a sticky upstream failure pattern emerges.
- **Cron sync is sequential (iter 6).** ~5 projects fit in the 60s Hobby budget today. At ~10+ projects switch to bounded `Promise.all` parallelism (3-5 concurrent `syncIssuesForProject` calls) before reaching for a queue.
- **AI assist runs only on workstream descriptions (iter 7).** Generate phase, detect dependencies, suggest risks all deferred to future iters pending validation that this first assist actually helps PMs. The infrastructure (route handler pattern, `ai_usage` table, hook, error classification) is reusable — adding a new operation is a CHECK enum extension + new prompt + new route + new strings.
- **No per-user AI rate limiting (iter 7).** Spend limit on the Anthropic Console is the only safety net. A single user with patience + a stable connection could trigger ~30 calls/min × $0.001 = ~$0.03/min in the worst case. Acceptable while audience is small (~5 PMs); add per-user quotas if abuse emerges.
- **AI cost classification is coarse (iter 7).** `classifyAnthropicError` doesn't distinguish 'rate limit' from 'spend limit reached' (both surface as 429 from Anthropic). The `errors.spendLimitReached` i18n string exists in the dictionary but isn't wired — needs Anthropic SDK error inspection for the specific quota signal. Document deferred until a PM hits the spend limit and asks for a clearer message.
- **AI summary truncation may degrade output for verbose Jira teams (iter 7).** Summaries truncated to 200 chars in prompt builder. Today NOXSCRUM summaries fit comfortably. If a future Jira instance has 300+ char summaries by convention, the truncation cuts mid-thought and the model loses context. Lever: extend to 400 chars OR start extracting `description` from `issues.raw` jsonb. Do NOT extend to 1000+ without re-evaluating cost.
- **`ai_usage` rows leak access patterns post-membership (iter 7).** Today every authenticated user reads every issue, so `summaries` JSONB cached in `ai_usage.input` discloses nothing new. When per-project membership lands (CLAUDE.md TODO under iter 4f), a user who loses access to a project still has historical `ai_usage` rows referencing those summaries. Decide cascade-delete vs re-validate-on-render at that point.
- **No manual purge UI for tombstones (iter 9a).** Issues marked `deleted_at` live in the DB forever. Acceptable while issue counts are low (NOXSCRUM ~813 rows); when a project accumulates a meaningful fraction of tombstones consider either a periodic vacuum that hard-deletes rows tombstoned > N days, or an admin "purge" Server Action with confirmation. Not implemented today.
- **No tombstone history (iter 9a).** `issues.deleted_at` only carries the most recent detection event. If a key is deleted, restored, deleted again, all we keep is the latest value. A separate `issue_deletion_history` audit table would surface flapping; not built because the current detection is daily and idempotent.
- **`issue_links` keep pointing at tombstoned source/target (iter 9a).** The links table doesn't cascade or filter on `deleted_at`; consumers filter at query time (blocked_stats CTE adds `i.deleted_at IS NULL`, the drawer already lazy-fetches missing data). If a new surface needs cleaner data, push the filter into the read rather than mutate the links table on tombstone.
- **Cross-project provider dependencies don't auto-prompt on deletion (iter 9a).** `narrative_dependencies.provider_jira_issue_keys` is TEXT[], no FK. When a referenced provider issue gets tombstoned the UI shows the 3rd-bucket "deleted" counter on `DependencyCard.ProviderBlock` but the PM has no notification. Manual review at narrative-edit time remains the workflow until a digest / alert surface exists.

## Dev tools

- **`/dev/components-preview`** — permanent visual bench for
  components, accessible only by typing the URL (not linked from
  production navigation). Server Component, statically rendered, zero
  runtime cost when not visited. Add new sections here as new
  components or variants need visual validation. Today the page
  carries the Issue Chips canonical map plus the alt-icon variants we
  considered for Epic and Story before locking 4c.1.

## Out of scope (do NOT add without asking)

Per-user roles or permissions (every authenticated user has the same rights today), email/password fallback, magic links, 2FA, custom recovery flows, multi-tenancy, public sharing without login (tokenized share links for `/preview` are a future iteration — today every authenticated user can read every narrative, but reaching the URL still requires login), **a second cron entry beyond the daily Jira sync** (Hobby plan caps at 2; the slot is reserved for genuine emergencies, not nice-to-haves), **upgrading to Vercel Pro** (the daily-sync cadence + 60s function budget fits Hobby; only revisit if sync timing forces a parallelism / queue refactor first), **email / Slack notifications for sync failures** (badge + Vercel logs are sufficient at iter 6 cadence — too noisy otherwise), Inngest / Trigger.dev / background queue libraries (no need until Hobby budget breaks; deferred per iter 6 spec), Recharts, React Flow, TanStack Table, **Gantt libraries** (gantt-task-react, frappe-gantt, etc. — the roadmap is intentionally hand-rolled SVG + HTML), alternative auth libraries (NextAuth, Clerk, Auth.js — Supabase Auth alcanza), **alternative i18n libraries** (the next-intl contract is locked — react-intl, lingui, FormatJS standalone are not on the table), **new locales beyond `en` / `es`** without product asking, **other AI providers** (OpenAI, Gemini, etc. — the Anthropic SDK + Claude Haiku 4.5 contract is locked for iter 7; revisit only if Anthropic raises pricing materially or deprecates Haiku), **AI operations beyond workstream descriptions** (generate phase / detect dependencies / suggest risks all deferred until iter 7 is validated with real PM use), **AI prompt customization by user** (prompts fixed in code; users can't override system / user prompts), **per-user AI quotas** (spend limit on Anthropic Console suffices while audience is small), **AI model selection from UI** (the model is pinned in `src/lib/ai/client.ts`), **showing AI costs to end users** (cost is internal observability data, not a user-facing surface), **AI response caching** (each request hits Anthropic fresh — caching would amortize cost but introduce stale-output bugs), new routes beyond the ones listed in Architecture, any library outside the locked stack.
