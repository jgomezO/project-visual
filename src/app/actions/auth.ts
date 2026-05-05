"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";

// Sign out + redirect to /login. Called from the UserMenu dropdown via
// useTransition so the dropdown can show "Cerrando sesión…" until the
// redirect lands. redirect() throws a special signal that React /
// Next absorb cleanly inside transitions.
export async function logoutAction(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
