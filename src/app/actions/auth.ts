"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getServerSupabase } from "@/lib/supabase/server";

// Sign out + redirect to /login. Called from the UserMenu dropdown via
// useTransition so the dropdown can show "Cerrando sesión…" until the
// redirect lands. redirect() throws a special signal that React /
// Next absorb cleanly inside transitions.
//
// iter 5 (i18n): the redirect target carries the active locale prefix
// so the user lands on the login page in the language they were
// using. getLocale() reads the request context which next-intl's
// middleware populates from URL or NEXT_LOCALE cookie.
export async function logoutAction(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect(`/${locale}/login`);
}
