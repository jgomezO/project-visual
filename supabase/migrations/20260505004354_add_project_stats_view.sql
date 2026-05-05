-- Per-project aggregates for the /projects list page.
--
-- The page used to compute totals in app code (one IN() query for all
-- issues, then group in JS). PostgREST caps single requests at 1000
-- rows by default; once a tenant accumulates a few thousand issues
-- across projects the projects at the tail of the alphabet started
-- reporting zero issues on the card while the per-project detail
-- page (which uses the project_dashboard RPC) showed correct data.
--
-- This view collapses the count to N rows (one per project) — no
-- pagination concerns, no tail truncation, no app-side grouping.
--
-- security_invoker = true means the view executes with the caller's
-- privileges and respects RLS on the underlying tables. Today RLS is
-- read-open on both `projects` and `issues`, so the anon role can
-- read this view; when RLS tightens, the view automatically follows.

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
  COUNT(i.id) FILTER (WHERE i.status_category = 'Done')::INT AS done_issues
FROM projects p
LEFT JOIN issues i ON i.project_id = p.id
GROUP BY p.id, p.key, p.name, p.lead_display_name, p.last_synced_at;

GRANT SELECT ON project_stats TO anon, authenticated;

COMMENT ON VIEW project_stats IS
  'Per-project totals for the /projects list page. Replaces the in-app aggregation that broke once total issues > PostgREST default row cap (1000).';
