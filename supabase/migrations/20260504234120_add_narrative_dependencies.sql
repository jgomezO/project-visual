-- Cross-team dependencies declared inside a narrative. Distinct from
-- issue_links: this is *executive* coordination metadata curated by the
-- PM, not a technical link between two issues. A dependency may be
-- backed by zero, one, or many provider issues, may target a different
-- Jira project (the "PoD"), and carries two independent dates plus a
-- manual commitment_status that the PM owns.

-- ============================================================================
-- narrative_dependencies
-- ============================================================================
CREATE TABLE narrative_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  narrative_id UUID NOT NULL
    REFERENCES project_narratives(id) ON DELETE CASCADE,
  -- Optional: the dependency may apply to a single workstream or to the
  -- whole narrative (NULL = "Toda la narrativa"). On workstream delete
  -- we SET NULL rather than CASCADE so the dependency record (often the
  -- result of a multi-team negotiation) survives a workstream rename or
  -- restructure on the consumer side. The "is this workstream really
  -- in this narrative?" check is enforced by the editor UI — see
  -- CLAUDE.md "Why no composite FK on workstream_id".
  workstream_id UUID
    REFERENCES narrative_workstreams(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,

  -- "PoD" = the team / squad providing the dependency. Free text so the
  -- PM isn't forced into a non-existent team registry. The optional
  -- `_project_key` links to a Jira project for "Abrir en Jira" affordances
  -- and to scope the issue autocomplete in the editor. We do NOT
  -- foreign-key it to projects(key) because the PM may reference a team
  -- whose Jira project we haven't synced yet (or never will).
  provider_pod TEXT,
  provider_pod_project_key TEXT,
  provider_jira_issue_keys TEXT[] NOT NULL DEFAULT '{}',

  -- Two independent dates. We do NOT enforce
  -- `needed_by_date <= expected_delivery_date` — when they're inverted
  -- that's the most valuable executive signal (the slippage gap), not
  -- a data error.
  needed_by_date DATE,
  expected_delivery_date DATE,

  commitment_status TEXT NOT NULL DEFAULT 'proposed'
    CHECK (commitment_status IN
      ('proposed', 'agreed', 'confirmed', 'at_risk', 'blocked')),

  coordination_notes TEXT,
  order_index INT NOT NULL,

  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX narrative_dependencies_narrative_id_order_idx
  ON narrative_dependencies(narrative_id, order_index);

-- "All dependencies pointing at provider X" — useful when the team
-- working on X needs to see who depends on them. Cheap; scoped by
-- the arbitrary text key the PM types (or auto-fills from autocomplete).
CREATE INDEX narrative_dependencies_provider_key_idx
  ON narrative_dependencies(provider_pod_project_key);

-- "Which dependencies reference this Jira issue?" — same role as the
-- equivalent GIN on narrative_workstreams.jira_issue_keys.
CREATE INDEX narrative_dependencies_provider_issues_gin_idx
  ON narrative_dependencies USING GIN (provider_jira_issue_keys);

CREATE TRIGGER narrative_dependencies_set_updated_at
  BEFORE UPDATE ON narrative_dependencies
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

COMMENT ON TABLE narrative_dependencies IS
  'Executive cross-team commitments declared in a narrative. Distinct from issue_links: this is human-curated coordination metadata (commitment_status, two dates, coordination_notes) — not a technical relationship between two Jira issues.';

COMMENT ON COLUMN narrative_dependencies.workstream_id IS
  'Optional. NULL = the dependency applies to the whole narrative. SET NULL on workstream delete because the dependency record outlives a workstream rename/restructure.';

COMMENT ON COLUMN narrative_dependencies.provider_pod IS
  'Free-text team / squad name. The optional provider_pod_project_key links to a Jira project for deep links and to scope provider-issue autocomplete; not a FK because the team''s project may not be synced.';

COMMENT ON COLUMN narrative_dependencies.needed_by_date IS
  'When the consuming project needs the dependency delivered.';

COMMENT ON COLUMN narrative_dependencies.expected_delivery_date IS
  'When the provider has committed to deliver. Not constrained against needed_by_date — when expected > needed, the gap is the slippage signal we want to surface.';

COMMENT ON COLUMN narrative_dependencies.commitment_status IS
  'Manual: proposed | agreed | confirmed | at_risk | blocked. Curated by the PM; never auto-derived from Jira state.';

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE narrative_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_read ON narrative_dependencies
  FOR SELECT TO anon, authenticated USING (TRUE);
