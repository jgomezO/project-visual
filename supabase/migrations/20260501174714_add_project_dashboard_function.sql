-- =====================================================================
-- Aggregations for /projects/[key]: project metadata + 6 KPI counters
-- in a single round trip (no per-counter follow-ups from the app).
--
-- Operative semantics:
--   * "overdue" = due_date < CURRENT_DATE AND status_category != 'Done'.
--     A Done issue past its due_date is NOT operationally overdue —
--     it shipped, late or not.
--   * "blocked" = the issue has an outgoing link of type 'is blocked
--     by' (i.e., a row in issue_links where source_issue_id = the
--     issue and link_type = 'is blocked by'), AND the issue itself is
--     not Done. We use the source-side because the iter-2 sync stores
--     both link directions; the source-side is more intuitive ("this
--     issue is waiting on something").
--   * link_type comparison uses lower() because Jira does not
--     normalize the case across instances / link configurations.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.project_dashboard(p_project_key TEXT)
RETURNS TABLE (
  project_id            TEXT,
  project_key           TEXT,
  project_name          TEXT,
  lead_display_name     TEXT,
  last_synced_at        TIMESTAMPTZ,
  total                 INT,
  todo_count            INT,
  in_progress_count     INT,
  done_count            INT,
  overdue_count         INT,
  blocked_count         INT
)
LANGUAGE SQL STABLE AS $$
  WITH proj AS (
    SELECT id, key, name, lead_display_name, last_synced_at
    FROM projects
    WHERE key = p_project_key
  ),
  issue_stats AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status_category = 'To Do')::int        AS todo_count,
      COUNT(*) FILTER (WHERE status_category = 'In Progress')::int  AS in_progress_count,
      COUNT(*) FILTER (WHERE status_category = 'Done')::int         AS done_count,
      COUNT(*) FILTER (
        WHERE due_date < CURRENT_DATE
          AND status_category <> 'Done'
      )::int AS overdue_count
    FROM issues
    WHERE project_id = (SELECT id FROM proj)
  ),
  blocked_stats AS (
    SELECT COUNT(DISTINCT il.source_issue_id)::int AS blocked_count
    FROM issue_links il
    JOIN issues i ON i.id = il.source_issue_id
    WHERE i.project_id = (SELECT id FROM proj)
      AND lower(il.link_type) = 'is blocked by'
      AND i.status_category <> 'Done'
  )
  SELECT
    (SELECT id FROM proj)                AS project_id,
    (SELECT key FROM proj)               AS project_key,
    (SELECT name FROM proj)              AS project_name,
    (SELECT lead_display_name FROM proj) AS lead_display_name,
    (SELECT last_synced_at FROM proj)    AS last_synced_at,
    issue_stats.total,
    issue_stats.todo_count,
    issue_stats.in_progress_count,
    issue_stats.done_count,
    issue_stats.overdue_count,
    blocked_stats.blocked_count
  FROM issue_stats, blocked_stats
  WHERE EXISTS (SELECT 1 FROM proj);
$$;

-- The function runs SECURITY INVOKER (default), so RLS on underlying
-- tables applies via the caller's role. anon already has SELECT on
-- projects / issues / issue_links from the iter-2 RLS policies.
GRANT EXECUTE ON FUNCTION public.project_dashboard(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.project_dashboard(TEXT) TO authenticated;
