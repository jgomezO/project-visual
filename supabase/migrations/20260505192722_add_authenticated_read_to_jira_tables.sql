-- iter 4f hotfix: getServerSupabase (authenticated session) needs SELECT
-- access to the Jira tables.
--
-- The init migration created SELECT policies "anon read projects" / "anon
-- read issues" / "anon read issue_links" / "anon read sync_runs" that
-- only list the `anon` role. That worked fine while every read went
-- through the anon client. Commit 5 of iter 4f switched
-- src/lib/narratives/queries.ts to the cookies-aware server client (role
-- `authenticated`); the project lookup inside getNarrativesByProject
-- then started returning null for authenticated users, and the
-- narratives list page showed empty.
--
-- Non-destructive fix: add parallel SELECT policies for authenticated.
-- The anon policies stay in place so JiraIssueKeysInput and
-- PodAutocompleteInput's browser-side autocomplete keep working without
-- changes.
--
-- We don't touch issue_links or sync_runs strictly for the narrative
-- bug above, but extending them at the same time keeps the four Jira
-- tables consistent and unblocks future Server Component reads.

CREATE POLICY "authenticated read projects" ON projects
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "authenticated read issues" ON issues
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "authenticated read issue_links" ON issue_links
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "authenticated read sync_runs" ON sync_runs
  FOR SELECT TO authenticated USING (TRUE);
