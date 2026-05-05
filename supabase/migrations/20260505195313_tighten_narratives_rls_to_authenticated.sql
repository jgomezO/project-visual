-- iter 4f (Migration B): flip narratives RLS from anon-readable to
-- authenticated-only, and from service-role-only-writes to
-- authenticated-can-write.
--
-- This is the second of two iter 4f migrations. Migration A (already
-- applied) added user_profiles + the trigger + GRANT EXECUTE on the
-- claim_next_* RPCs to authenticated. This one closes the gate: only
-- logged-in users can read or write narrative data.
--
-- Apply this migration ATOMICALLY with the corresponding code change
-- in src/lib/narratives/mutations.ts (switch from getServerSupabaseAdmin
-- to getServerSupabase). The two together flip the runtime behavior:
-- writes start going through the user's session and the new policies
-- enforce that they're authenticated.
--
-- The Jira tables (projects, issues, issue_links, sync_runs) and the
-- project_stats view stay as-is — the iter 4f hotfix already gave
-- authenticated SELECT alongside the original anon SELECT, and writes
-- there are still service-role-only (sync). The browser-side
-- JiraIssueKeysInput and PodAutocompleteInput keep working unchanged.
--
-- ============================================================================
-- 1. Drop the existing anon-read policies on the five narrative tables
-- ============================================================================

DROP POLICY IF EXISTS anon_read ON project_narratives;
DROP POLICY IF EXISTS anon_read ON narrative_phases;
DROP POLICY IF EXISTS anon_read ON narrative_workstreams;
DROP POLICY IF EXISTS anon_read ON narrative_dependencies;
DROP POLICY IF EXISTS anon_read ON narrative_risks;

-- ============================================================================
-- 2. New authenticated-only policies covering all operations
-- ============================================================================
-- FOR ALL covers SELECT + INSERT + UPDATE + DELETE in one policy. Same
-- effect as four FOR <op> policies but the intent ("logged-in users can
-- do anything on this table") reads cleanly. service_role still bypasses
-- RLS by design — sync, seed, and CLI scripts continue working.
--
-- USING(TRUE) for read filter, WITH CHECK(TRUE) for write filter — no
-- per-row predicates yet. When per-project membership lands (post-iter
-- 4f), tighten by replacing TRUE with a join against user_profiles or
-- a project_members table.

CREATE POLICY auth_all ON project_narratives
  FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY auth_all ON narrative_phases
  FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY auth_all ON narrative_workstreams
  FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY auth_all ON narrative_dependencies
  FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY auth_all ON narrative_risks
  FOR ALL TO authenticated
  USING (TRUE) WITH CHECK (TRUE);
