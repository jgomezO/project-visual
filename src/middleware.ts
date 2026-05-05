import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Auth gate for every request that isn't a static asset or one of the
// allowlisted public paths. Two responsibilities:
//
//   1. Refresh the Supabase Auth session on each request. createServerClient
//      writes new cookies into `response` via the setAll hook below when
//      getUser detects an expiring access token. Without this hook in
//      middleware, sessions would expire mid-flight on long-lived tabs.
//
//   2. Redirect unauthenticated users to /login (and authenticated users
//      away from /login).
//
// CRITICAL: validate this locally before pushing. A bug here can lock the
// whole deploy out — there's no UI escape hatch. See the smoke matrix
// in the PR description.

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Throwing produces a 500. Better than the silent alternatives:
    // failing open would skip auth entirely; failing closed without a
    // log would be a debug nightmare.
    throw new Error(
      "middleware: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing",
    );
  }

  // Mutable response object — gets replaced by setAll when cookies refresh.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Mirror the new cookies onto the request (so getUser sees them
        // within this middleware run) and onto the response (so the
        // browser stores them for the next request).
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() hits Supabase's auth server and refreshes cookies if the
  // access token is close to expiring. NEVER swap for getSession() —
  // that reads cookies locally and a tampered cookie would falsely pass.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic =
    path === "/login" ||
    path.startsWith("/auth/callback") ||
    path.startsWith("/api/sync") ||
    path.startsWith("/api/cron/");

  if (!user && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    return preserveCookies(NextResponse.redirect(target), response);
  }

  if (user && path === "/login") {
    const target = request.nextUrl.clone();
    target.pathname = "/projects";
    return preserveCookies(NextResponse.redirect(target), response);
  }

  return response;
}

// When we redirect, the refreshed-session cookies on `source` would be
// lost on a fresh NextResponse.redirect. Copy them so the browser stores
// the new tokens — otherwise the next request comes in with the old
// (possibly expiring) cookies and we re-do the refresh round-trip.
function preserveCookies(
  redirect: NextResponse,
  source: NextResponse,
): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}

export const config = {
  // Run on every path except Next internals and common static assets.
  // /api/sync and /api/cron/* are NOT excluded here (the middleware
  // function checks them as public and short-circuits) so the matcher
  // stays simple and the public-allowlist logic lives in one place.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
