-- iter 9a: soft-delete tombstone for issues removed in Jira upstream.
--
-- Detection logic in src/lib/sync/detect-deleted.ts runs AFTER a
-- successful per-project upsert (post-fetch, post-link-upsert) and
-- compares freshKeys (the Jira response) against DB keys. Issues
-- present in DB but missing from Jira → deleted_at = NOW(). Issues
-- previously marked deleted that reappear → deleted_at = NULL
-- (auto-restore). No threshold, no rollback — bad-data windows
-- self-heal on next successful sync.
--
-- Queries that show only "active" issues must filter
-- `deleted_at IS NULL`. Soft-delete-aware surfaces (ProjectTable
-- "Mostrar borradas" toggle, narrative public counters, deleted
-- chip in JiraIssueKeysInput) read both branches.

ALTER TABLE issues
  ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN issues.deleted_at IS
  'Soft-delete marker. Set when the issue exists in DB but is no '
  'longer returned by a successful full sync of its project. NULL '
  'while the issue is still active in Jira (or has not been synced '
  'since the deletion). Auto-restored to NULL when the issue '
  'reappears in a later sync.';

-- Partial index: most queries filter `deleted_at IS NULL` and use
-- existing indexes (project_id, key, parent_id). The deleted set is
-- a small minority. A partial index on non-NULL rows speeds up
-- "show me deleted issues for project X" without bloating the index
-- for the common active-only path.
CREATE INDEX issues_deleted_at_idx
  ON issues(deleted_at)
  WHERE deleted_at IS NOT NULL;
