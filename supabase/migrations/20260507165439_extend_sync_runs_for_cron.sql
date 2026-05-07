-- iter 6: per-project resilient sync + Vercel Cron support.
--
-- Three additions to sync_runs:
--   1. triggered_by — distinguishes manual UI / curl invocations from
--      automated Vercel Cron runs.
--   2. status now includes 'partial' — at least one project synced
--      successfully but at least one other failed. /api/sync returns
--      HTTP 200 in this case (some progress made).
--   3. failed_projects JSONB — per-project errors when status is
--      'partial' OR 'failed' with multiple projects involved. NULL
--      when status = 'success' (clean run, no errors).

-- 1. triggered_by
ALTER TABLE sync_runs
  ADD COLUMN triggered_by TEXT NOT NULL DEFAULT 'manual'
  CHECK (triggered_by IN ('manual', 'cron'));

COMMENT ON COLUMN sync_runs.triggered_by IS
  'Distinguishes manual UI / curl invocations from automated Vercel Cron runs.';

-- 2. Replace the inline status CHECK to allow 'partial'.
--    Postgres auto-named the original constraint sync_runs_status_check
--    (verified via pg_constraint introspection on the linked project).
ALTER TABLE sync_runs DROP CONSTRAINT sync_runs_status_check;
ALTER TABLE sync_runs
  ADD CONSTRAINT sync_runs_status_check
  CHECK (status IN ('running', 'success', 'failed', 'partial'));

-- 3. failed_projects: array of {projectKey, error} entries.
--    Stored as JSONB (not a typed table) because:
--      - The shape is bounded and read-mostly (UI badge + manual debugging).
--      - Per-project rows would inflate the table 5x per cron run for a
--        feature that doesn't need joinable history.
--      - PostgREST surfaces JSONB cleanly to the client.
ALTER TABLE sync_runs
  ADD COLUMN failed_projects JSONB;

COMMENT ON COLUMN sync_runs.failed_projects IS
  'JSON array of {projectKey, error} entries. Populated when one or more '
  'projects failed during a run. NULL on clean success.';
