-- iter 7: AI assist for workstream descriptions.
--
-- Audit log of every AI operation: input, output, tokens, cost, errors.
-- Drives debugging today and a future operations dashboard for cost
-- analysis (per-user totals, per-operation success rate, etc.).
--
-- Privacy contract: each user reads only their OWN rows via RLS
-- self-read; service_role bypasses RLS for INSERTs (Server Action with
-- admin client). No INSERT/UPDATE/DELETE policies for `authenticated` —
-- the audit log is immutable from the application's perspective.

CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Actor. user_email is denormalized so cost-by-team queries don't
  -- need a join to auth.users. Documented as "truth-in-moment": if a
  -- user changes their email later, historical rows keep showing the
  -- email of when the row was written. Acceptable for an audit log.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,

  -- Operation context. The CHECK enumerates today's two operations.
  -- Adding a new operation (e.g. 'generate_phase' in iter 8) requires
  -- ALTERing this CHECK — that's deliberate; we want every new AI
  -- surface to be a conscious schema change.
  operation TEXT NOT NULL CHECK (
    operation IN (
      'generate_workstream_description',
      'refine_workstream_description'
    )
  ),

  -- Both nullable + ON DELETE SET NULL: an operation that targeted a
  -- workstream that's later deleted should still appear in the user's
  -- audit log; the row just loses its FK to the (now-gone) entity.
  workstream_id UUID REFERENCES narrative_workstreams(id) ON DELETE SET NULL,
  narrative_id  UUID REFERENCES project_narratives(id)    ON DELETE SET NULL,

  -- input JSONB shape per operation:
  --   generate: { issueKeys: string[], summaries: string[], locale: 'en'|'es' }
  --   refine:   { issueKeys: string[], summaries: string[], currentText: string, locale: 'en'|'es' }
  -- Summaries are truncated to 200 chars by the prompt builder before
  -- being logged here, so this column won't bloat on long Jira issues.
  input  JSONB NOT NULL,
  output TEXT,

  -- Metrics. NULL when status='error' AND we never got a usage event
  -- back from Anthropic (e.g. immediate auth failure). Non-negative
  -- CHECKs are cheap defensive guards against client bugs that might
  -- otherwise log negative durations / costs.
  input_tokens  INTEGER CHECK (input_tokens  IS NULL OR input_tokens  >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  cost_usd      DECIMAL(10, 6) CHECK (cost_usd IS NULL OR cost_usd >= 0),
  duration_ms   INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),

  -- Status. 'cancelled' = client aborted (navigation, modal close).
  -- Anthropic still bills partial input + output before the abort
  -- propagates, so cost_usd is typically non-zero on cancelled rows.
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'cancelled')),
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  ai_usage IS
  'Audit log of AI assist operations. Per-user RLS read-only; '
  'service_role bypass for INSERTs from Server Actions. Immutable.';

COMMENT ON COLUMN ai_usage.user_email IS
  'Denormalized snapshot of auth.users.email at write time. Stale by '
  'design if the user changes their email — this is an audit log.';

COMMENT ON COLUMN ai_usage.cost_usd IS
  'Computed server-side from input_tokens * input_rate + output_tokens '
  '* output_rate. Pricing constants in src/lib/ai/usage/pricing.ts; '
  'verify against anthropic.com/pricing if discrepancies emerge.';

-- RLS: per-user self-read, no other policies.
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- (SELECT auth.uid()) wrapper turns the call into a one-time subquery
-- evaluation per query instead of per row — Supabase's documented
-- performance pattern for RLS predicates.
CREATE POLICY ai_usage_self_read ON ai_usage
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- No INSERT/UPDATE/DELETE policy for `authenticated` is intentional.
-- service_role bypasses RLS by design and writes from Server Actions
-- (admin client). The audit log is immutable from the app's POV.

-- Indexes:
--   - (user_id, created_at DESC): the workhorse for "show me my recent
--     usage" — the only query the UI surface will issue today.
--   - operation: per-operation analytics (success rate, avg cost).
--   - status: filter cancelled / error rows for debugging.
CREATE INDEX ai_usage_user_id_created_at_idx ON ai_usage(user_id, created_at DESC);
CREATE INDEX ai_usage_operation_idx          ON ai_usage(operation);
CREATE INDEX ai_usage_status_idx             ON ai_usage(status);
