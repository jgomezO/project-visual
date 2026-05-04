-- Narratives layer for /projects/[key]/narrative (UI lands in iter 4b).
-- Three tables linked to the existing `projects` row by Jira project id.
-- A narrative is the human-written presentation of a project for non-technical
-- audiences (board, customers, C-level); phases and workstreams group its
-- structure. The narrative does NOT duplicate Jira state — workstreams hold
-- only `jira_issue_keys` references, and the operational data (status,
-- progress, dates) is read live from `issues`.

-- The `moddatetime` extension is already enabled by the init migration; we
-- reuse it for updated_at maintenance.

-- ============================================================================
-- project_narratives
-- ============================================================================
CREATE TABLE project_narratives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  overview TEXT,
  status_summary TEXT,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  -- created_by / updated_by are placeholders until user-level auth lands.
  -- Seeded with literal "system" or the configured Jira email.
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX project_narratives_project_id_idx
  ON project_narratives(project_id);
CREATE INDEX project_narratives_published_idx
  ON project_narratives(published);

CREATE TRIGGER project_narratives_set_updated_at
  BEFORE UPDATE ON project_narratives
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

COMMENT ON TABLE project_narratives IS
  'Human-written presentation layer for a Jira project. Multiple narratives per project allowed (e.g. board version vs customer version). Operational data is NOT duplicated here — it is read live from issues + project_dashboard.';

-- ============================================================================
-- narrative_phases
-- ============================================================================
CREATE TABLE narrative_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  narrative_id UUID NOT NULL REFERENCES project_narratives(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT,
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('completed', 'in_progress', 'upcoming', 'at_risk')),
  progress_percent INT
    CHECK (progress_percent IS NULL OR (progress_percent BETWEEN 0 AND 100)),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date),
  -- Required by the composite FK in narrative_workstreams below. The
  -- redundant index next to the PK is the price for declarative
  -- cross-table consistency without a custom trigger.
  UNIQUE (id, narrative_id)
);

CREATE INDEX narrative_phases_narrative_id_order_idx
  ON narrative_phases(narrative_id, order_index);

CREATE TRIGGER narrative_phases_set_updated_at
  BEFORE UPDATE ON narrative_phases
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

COMMENT ON TABLE narrative_phases IS
  'Ordered phases inside a narrative. status / progress_percent are manual fields the PM curates; the UI may DERIVE alternates from issues but the schema does not.';

-- ============================================================================
-- narrative_workstreams
-- ============================================================================
CREATE TABLE narrative_workstreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  narrative_id UUID NOT NULL REFERENCES project_narratives(id) ON DELETE CASCADE,
  -- Optional: NULL means the workstream sits at the narrative root, beside
  -- phases. The composite FK below enforces that a non-NULL phase_id
  -- belongs to the same narrative.
  phase_id UUID,
  order_index INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  jira_issue_keys TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Composite FK: when phase_id is set, the (phase_id, narrative_id) pair
  -- must exist in narrative_phases. With phase_id = NULL, MATCH SIMPLE
  -- (PostgreSQL default) skips the check entirely. Native FK semantics
  -- replace the BEFORE-INSERT trigger we considered: same correctness,
  -- atomic with the row write, no plpgsql to maintain.
  CONSTRAINT fk_workstream_phase_narrative
    FOREIGN KEY (phase_id, narrative_id)
    REFERENCES narrative_phases(id, narrative_id)
    ON DELETE CASCADE
);

CREATE INDEX narrative_workstreams_narrative_id_order_idx
  ON narrative_workstreams(narrative_id, order_index);
CREATE INDEX narrative_workstreams_phase_id_order_idx
  ON narrative_workstreams(phase_id, order_index);
-- GIN on the keys array lets a future "which workstreams reference this
-- issue?" query stay fast as the narrative count grows.
CREATE INDEX narrative_workstreams_jira_keys_gin_idx
  ON narrative_workstreams USING GIN (jira_issue_keys);

CREATE TRIGGER narrative_workstreams_set_updated_at
  BEFORE UPDATE ON narrative_workstreams
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

COMMENT ON TABLE narrative_workstreams IS
  'Workstreams (chunks of work) inside a narrative. May live under a phase or directly under the narrative (phase_id NULL = "orphan" / cross-cutting). jira_issue_keys is a reference list; live status comes from the issues table.';

COMMENT ON COLUMN narrative_workstreams.phase_id IS
  'NULL = workstream sits at the narrative root, beside phases, ordered by order_index. NOT NULL = workstream lives inside a phase whose narrative_id matches this row''s (enforced by composite FK).';

-- ============================================================================
-- Row Level Security
-- ============================================================================
-- Read-open for now (no user auth yet). Service role bypasses RLS for writes.
-- TODO: tighten when user-level auth lands. Likely: SELECT for any
-- authenticated user, INSERT/UPDATE/DELETE only for narrative owners /
-- project members.
ALTER TABLE project_narratives ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_workstreams ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_read ON project_narratives
  FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY anon_read ON narrative_phases
  FOR SELECT TO anon, authenticated USING (TRUE);
CREATE POLICY anon_read ON narrative_workstreams
  FOR SELECT TO anon, authenticated USING (TRUE);
