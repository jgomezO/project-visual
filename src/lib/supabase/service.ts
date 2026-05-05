import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let cached: SupabaseClient<Database> | null = null;

// Service-role Supabase client for operations that bypass RLS by design:
//   - Sync from Jira (runs outside any user context)
//   - Seed and CLI scripts
//   - System-level mutations that aren't tied to a logged-in actor
//
// For user-facing reads / writes that should respect RLS, use
// getServerSupabase() from "./server" instead — that one carries the
// user's auth cookies.
export function getServerSupabaseAdmin(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Missing Supabase env var(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env.local and fill in your credentials.`,
    );
  }

  cached = createClient<Database>(url!, serviceKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  return cached;
}

/**
 * @deprecated Renamed to getServerSupabaseAdmin for symmetry with
 * getServerSupabase. Will be removed at the end of iter 4f. Update
 * call sites at your convenience during this iteration.
 */
export const getServiceSupabase = getServerSupabaseAdmin;
