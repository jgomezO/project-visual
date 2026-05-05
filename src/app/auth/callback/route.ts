import { NextResponse, type NextRequest } from "next/server";
import { isAllowedDomain } from "@/lib/auth/domain-check";
import { verifyUserInJira } from "@/lib/auth/verify-jira-user";
import { getServerSupabase } from "@/lib/supabase/server";

// OAuth callback. Supabase Auth redirects here with ?code=<one-time>.
// Exchange it for a session, then run the two app-level gates:
//   1. Email domain must be on ALLOWED_EMAIL_DOMAINS
//   2. Email must resolve to a real Jira user (cached in user_profiles
//      after first success so subsequent logins skip the API hit)
//
// Any failure → signOut() + redirect to /login?error=<code>.
//
// Eligible for the Edge runtime in theory, but we stay on Node so
// fetch-with-AbortSignal.timeout (used by verifyUserInJira) and the
// Supabase server client behave like the rest of the app.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=unknown`);
  }

  const supabase = await getServerSupabase();

  const { error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("[auth/callback] exchangeCodeForSession failed:", exchangeError);
    return NextResponse.redirect(`${origin}/login?error=unknown`);
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user || !user.email) {
    console.error("[auth/callback] getUser failed:", userError);
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=unknown`);
  }

  // Gate 1: domain whitelist.
  if (!isAllowedDomain(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  // Skip the Jira API hit if we've already verified this user before.
  // RLS user_profiles_self_read makes this safe — only the user's own
  // row is visible to them.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("jira_account_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.jira_account_id) {
    return NextResponse.redirect(`${origin}/projects`);
  }

  // Gate 2: Jira verification (first login only). The trigger should
  // have already created the user_profiles row by the time we get
  // here — same transaction as the auth.users insert. If for some
  // reason it didn't, the update below upserts.
  const accountId = await verifyUserInJira(user.email);
  if (!accountId) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=jira`);
  }

  // Cache the verification so future logins skip the API call.
  // Upsert (instead of update) defends against the trigger-skipped
  // edge case mentioned above; emails are unique so the conflict
  // target works.
  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        jira_account_id: accountId,
        jira_verified_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (upsertError) {
    console.warn(
      "[auth/callback] could not cache jira_account_id:",
      upsertError,
    );
    // Non-fatal: the user can still log in, we'll just re-verify on
    // next login. Don't punish them for a write failure.
  }

  return NextResponse.redirect(`${origin}/projects`);
}
