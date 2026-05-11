-- iter 9a: exclude soft-deleted issues from operational aggregations.
--
-- After iter 9a's tombstone column landed in `issues`, the existing
-- KPI surfaces still counted deleted rows: `project_dashboard()`
-- (powers /projects/[key] header) and `project_stats` (powers each
-- ProjectCard on /projects) both ran `COUNT(*) FROM issues WHERE
-- project_id = ...` with no further filter. After today, deleted
-- issues are invisible to the table by default but the headers and
-- card stats kept inflating their totals — incoherent.
--
-- This migration adds `deleted_at IS NULL` to every counter that
-- represents "active issues". Same signature, same column list — no
-- callers break.
--
-- DESIGN NOTE: on `project_stats` we use `COUNT(i.id) FILTER (WHERE
-- ... AND i.deleted_at IS NULL)` rather than moving `deleted_at IS
-- NULL` into the LEFT JOIN's ON clause. Two reasons:
--   1. FILTER keeps the JOIN inclusive so projects with ONLY deleted
--      issues still appear as a row (with total_issues = 0). Moving
--      the predicate into ON would drop the issue row but the project
--      row still appears via the LEFT JOIN, so functionally equivalent
--      here — but FILTER reads more declaratively.
--   2. Aligns with how done_issues is already expressed (FILTER on
--      status_category = 'Done'), keeping the two counters
--      structurally similar.

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
      AND deleted_at IS NULL
  ),
  blocked_stats AS (
    SELECT COUNT(DISTINCT il.source_issue_id)::int AS blocked_count
    FROM issue_links il
    JOIN issues i ON i.id = il.source_issue_id
    WHERE i.project_id = (SELECT id FROM proj)
      AND lower(il.link_type) = 'is blocked by'
      AND i.status_category <> 'Done'
      AND i.deleted_at IS NULL
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

GRANT EXECUTE ON FUNCTION public.project_dashboard(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.project_dashboard(TEXT) TO authenticated;


CREATE OR REPLACE VIEW project_stats
  WITH (security_invoker = true)
  AS
SELECT
  p.id,
  p.key,
  p.name,
  p.lead_display_name,
  p.last_synced_at,
  COUNT(i.id) FILTER (WHERE i.deleted_at IS NULL)::INT AS total_issues,
  COUNT(i.id) FILTER (
    WHERE i.status_category = 'Done'
      AND i.deleted_at IS NULL
  )::INT AS done_issues,
  COALESCE(n.narratives_count, 0)::INT AS narratives_count
FROM projects p
LEFT JOIN issues i ON i.project_id = p.id
LEFT JOIN (
  SELECT project_id, COUNT(*)::INT AS narratives_count
  FROM project_narratives
  GROUP BY project_id
) n ON n.project_id = p.id
GROUP BY
  p.id, p.key, p.name, p.lead_display_name, p.last_synced_at,
  n.narratives_count;

GRANT SELECT ON project_stats TO anon, authenticated;

COMMENT ON VIEW project_stats IS
  'Per-project totals for /projects. Excludes soft-deleted issues '
  '(iter 9a) — deleted rows count as zero against total_issues / '
  'done_issues so the cards agree with what the table surfaces by '
  'default. narratives_count added in iter 4g for the badge.';
