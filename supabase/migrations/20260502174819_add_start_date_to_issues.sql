-- Add start_date to issues, populated from Jira's customfield_10015
-- ("Start date", system datepicker). Nullable because not every issue has
-- one set in Jira; Epics and Stories typically do, sub-tasks rarely.
-- No index for now — re-evaluate when the roadmap view's queries justify it.

ALTER TABLE issues
  ADD COLUMN start_date DATE;

COMMENT ON COLUMN issues.start_date IS
  'Synced from Jira customfield_10015 ("Start date"). If running against another Jira instance with a different field id, the mapping in src/lib/sync/issues.ts must be updated (TODO: parametrize via env).';
