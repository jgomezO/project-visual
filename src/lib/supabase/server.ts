import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Server-side Supabase client that respects the user's session via the
// auth cookies set by Supabase Auth. Use this for:
//   - Reads from authenticated-only tables (narratives etc.)
//   - Writes that should reflect the acting user (e.g. created_by /
//     updated_by populated from auth.getUser())
//
// Don't use this for service-role operations (sync, scripts, the
// SECURITY DEFINER trigger) — those go through getServerSupabaseAdmin.
//
// Don't cache the client at module level: cookies() returns a per-
// request store, and the Supabase client closes over it. A cached
// instance from a previous request would read the wrong cookies.
export async function getServerSupabase(): Promise<SupabaseClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase env var(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env.local and fill in your credentials.`,
    );
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url!, anonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // setAll fails when called from a Server Component (cookies()
        // there is read-only). That's expected — Server Components
        // don't refresh sessions; the middleware does. Swallow the
        // exception so reads from RSC don't crash. Server Actions and
        // Route Handlers can write cookies and the call succeeds.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options as CookieOptions);
          }
        } catch {
          // No-op: read-only cookie context (Server Component).
        }
      },
    },
  });
}
