import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
}

// Server-side helper to fetch the user + display_name in one go for the
// UserMenu prop. Pages render behind the auth middleware, so user is
// guaranteed to exist by the time we get here — null only happens in
// pathological cases (middleware misconfigured) and we let the caller
// decide what to do.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  // display_name is populated by the on_auth_user_created trigger using
  // raw_user_meta_data.full_name (Google) or .name with email fallback.
  // Reading it with the user's session works thanks to the
  // user_profiles_self_read RLS policy.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email,
    displayName: profile?.display_name ?? user.email,
  };
}
