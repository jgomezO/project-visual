-- iter 4f (Migration A): Auth scaffolding — user_profiles + automatic
-- creation trigger + RLS + GRANT del RPC de identifiers a authenticated.
--
-- This migration is SAFE to apply now: it only adds new objects and a
-- new GRANT. It does NOT touch the existing RLS policies on the
-- narrative tables (those go in Migration B, after all the auth-aware
-- code is in place — splitting them avoids a window where reads break
-- before the new server client lands).
--
-- ============================================================================
-- Manual setup required BEFORE applying this migration:
-- ============================================================================
--
-- 1. Google Cloud Console:
--      console.cloud.google.com → APIs & Services → Credentials
--      → Create OAuth 2.0 Client ID → Web application
--      Authorized redirect URI: https://<SUPABASE_REF>.supabase.co/auth/v1/callback
--      Copy Client ID + Client Secret.
--
-- 2. Supabase Dashboard:
--      Authentication → Providers → Google: enable, paste Client ID + Secret.
--      Authentication → URL Configuration:
--        - Site URL: https://<vercel-prod-domain>
--        - Additional redirect URLs:
--            https://<vercel-prod-domain>/auth/callback
--            http://localhost:3000/auth/callback
--
-- 3. .env.local + Vercel Production:
--      ALLOWED_EMAIL_DOMAINS=veevart.com
--
-- ============================================================================

-- ============================================================================
-- 1. user_profiles — mirror app-side de auth.users
-- ============================================================================
-- One row per Supabase Auth user. Auto-created via trigger on auth.users
-- insert. The OAuth callback writes jira_account_id + jira_verified_at on
-- first successful login (cached so subsequent logins skip the Jira hit).

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  -- Cached on first login by /auth/callback. NULL means "not yet
  -- verified against Jira" — can happen between the trigger firing
  -- and the callback completing, or if a previous Jira check failed
  -- and the user retried login.
  jira_account_id TEXT,
  jira_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER user_profiles_set_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

COMMENT ON TABLE user_profiles IS
  'App-side mirror of auth.users. Auto-created via on_auth_user_created trigger. Holds the cached Jira accountId so subsequent logins skip the Jira API round-trip.';

-- ============================================================================
-- 2. Trigger: crea row en user_profiles cuando llega un user nuevo a auth.users
-- ============================================================================
-- SECURITY DEFINER + explicit search_path: the function runs with the
-- privileges of its owner (postgres), so it can INSERT into a public
-- table that authenticated/anon don't have direct INSERT on. Pinning
-- search_path is the standard guard against search-path attacks (an
-- attacker creating a same-named function in a writable schema).

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    -- Google sends the human name as raw_user_meta_data.full_name; some
    -- providers use 'name'. Fall back to email so we always have something
    -- to render in the UserMenu's avatar fallback.
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NEW.email
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 3. RLS: cada user lee/edita solo su propia row
-- ============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- (SELECT auth.uid()) wrapped in subquery — Postgres caches the result
-- per query rather than re-evaluating per row. Standard Supabase RLS
-- pattern for performance on big tables; harmless on small ones like
-- this one and keeps the convention consistent.
CREATE POLICY user_profiles_self_read ON user_profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY user_profiles_self_update ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- INSERT y DELETE intencionalmente sin policy abierta:
--   - INSERT lo maneja el trigger (SECURITY DEFINER bypassa RLS).
--   - DELETE solo via service_role o cascade desde auth.users.
-- Cualquier otro INSERT/DELETE desde authenticated se rechaza por
-- ausencia de policy.

-- ============================================================================
-- 4. GRANT EXECUTE de los RPCs claim_next_* a authenticated
-- ============================================================================
-- Hoy estos RPCs están GRANTed solo a service_role (su uso original era
-- desde mutations.ts con el client de service-role). Cuando las
-- mutations migren al server-client autenticado (commits 5-7 de iter
-- 4f), van a llamar a estos RPCs en nombre del usuario y necesitan
-- EXECUTE. Sin este GRANT, las llamadas fallarían con permission denied.
--
-- service_role mantiene su EXECUTE — el sync y los scripts CLI siguen
-- funcionando.

GRANT EXECUTE ON FUNCTION claim_next_risk_identifier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_next_dependency_identifier(UUID) TO authenticated;
