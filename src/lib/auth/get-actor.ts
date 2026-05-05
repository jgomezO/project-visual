import "server-only";
import { getServerSupabase } from "@/lib/supabase/server";

export interface Actor {
  id: string;
  email: string;
}

// Resolves the current authenticated user from cookies. Used by Server
// Actions to stamp created_by / updated_by with the real user's email.
//
// Server Actions run behind the auth middleware, so an unauthenticated
// request shouldn't reach this — the throw is a defensive backstop, not
// a path users should hit. If it ever fires, the middleware has a hole.
//
// TODO (iter 4f+): if email-as-actor turns out to be too brittle (user
// changes email, soft-delete needs), migrate to user.id and join
// user_profiles for display in the UI.
export async function getActor(): Promise<Actor> {
  const supabase = await getServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || !user.email) {
    throw new Error(
      "getActor: no authenticated user — middleware should have blocked this request",
    );
  }
  return { id: user.id, email: user.email };
}
