-- iter 4g (Migration C): extend project_stats with narratives_count, the
-- badge surfacing "X narrativas" on each ProjectCard in /projects.
--
-- We use CREATE OR REPLACE VIEW (no DROP) — Postgres allows appending
-- columns to a view as long as the existing column list is preserved
-- in name, order, and type. No dependent objects break.
--
-- The narrative count is fetched via a derived-table LEFT JOIN rather
-- than a third peer LEFT JOIN to project_narratives. Two parallel
-- LEFT JOINs to peer tables (issues + project_narratives) under one
-- GROUP BY would Cartesian-multiply rows: a project with 5 issues and
-- 3 narratives would yield 15 join rows, and COUNT(DISTINCT n.id) on
-- top would work but adds cognitive load. The subquery aggregates
-- narratives independently and joins exactly one row per project, so
-- the issue COUNT stays a simple, non-DISTINCT count.
--
-- COALESCE(..., 0) turns "no narratives" (NULL from the LEFT JOIN)
-- into 0, so the UI doesn't have to handle NULL.
--
-- security_invoker = true is preserved by CREATE OR REPLACE VIEW (the
-- WITH (...) clause must be re-stated on replace); RLS on the
-- underlying tables continues to apply. RLS on project_narratives is
-- currently auth_all FOR ALL TO authenticated USING(TRUE), so today
-- every authenticated user sees every project's count — that matches
-- the per-project detail pages they can reach. When per-project
-- membership lands, the count will narrow automatically.
--
-- GRANTs persist across CREATE OR REPLACE VIEW; we restate them
-- defensively so the migration is self-contained if ever replayed
-- against a fresh database.

CREATE OR REPLACE VIEW project_stats
  WITH (security_invoker = true)
  AS
SELECT
  p.id,
  p.key,
  p.name,
  p.lead_display_name,
  p.last_synced_at,
  COUNT(i.id)::INT AS total_issues,
  COUNT(i.id) FILTER (WHERE i.status_category = 'Done')::INT AS done_issues,
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
  'Per-project totals for the /projects list page. Replaces the in-app aggregation that broke once total issues > PostgREST default row cap (1000). narratives_count added in iter 4g for the "X narrativas" badge.';
