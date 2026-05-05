-- Fix-up for 20260505015746_add_narrative_risks.sql:
-- The original CHECK used `array_length(impacts, 1) >= 1`, which evaluates
-- to NULL for an empty array (array_length returns NULL when the dimension
-- is empty). Postgres treats CHECK = NULL as SATISFIED (only FALSE
-- violates), so empty arrays slipped through.
--
-- Replace with cardinality(arr) >= 1 — cardinality returns 0 for '{}',
-- so the comparison is FALSE and the constraint correctly rejects.

ALTER TABLE narrative_risks
  DROP CONSTRAINT narrative_risks_impacts_min,
  DROP CONSTRAINT narrative_risks_mitigations_min;

ALTER TABLE narrative_risks
  ADD CONSTRAINT narrative_risks_impacts_min
    CHECK (cardinality(impacts) >= 1),
  ADD CONSTRAINT narrative_risks_mitigations_min
    CHECK (cardinality(mitigations) >= 1);
