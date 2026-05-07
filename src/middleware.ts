import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

// Combined intl + auth middleware. Order matters:
//
//   1. Hard bypass for routes that need NEITHER intl NOR auth: route
//      handlers that are locale-agnostic and have their own auth
//      story (api/sync uses x-sync-secret, auth/callback runs after
//      Google OAuth, api/cron is reserved for future scheduled jobs).
//
//   2. Run the next-intl middleware. For BARE paths (no /en or /es
//      prefix) it returns a 307 redirect to the prefixed URL — based
//      on the NEXT_LOCALE cookie, falling back to defaultLocale='en'.
//      We respect that redirect immediately and skip auth: the next
//      request will come in with a prefix and we'll auth-check then.
//
//   3. For prefixed paths, intl returns NextResponse.next() (with
//      cookie sync if needed). We layer Supabase session refresh +
//      auth gates on top, mirroring Supabase cookies onto the same
//      response so intl's NEXT_LOCALE write and Supabase's session
//      refresh both reach the browser.
//
// CRITICAL: validate this locally before pushing. A bug here can
// lock the whole deploy out.

const intlMiddleware = createIntlMiddleware(routing);

const LOCALE_PREFIX_RE = /^\/(en|es)(\/|$)/;

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Step 1: bypass route handlers that are locale-agnostic.
  if (
    path === "/auth/callback" ||
    path.startsWith("/api/sync") ||
    path.startsWith("/api/cron/")
  ) {
    return NextResponse.next();
  }

  // Step 2: hand off to intl middleware. It either returns a redirect
  // (bare path → /<locale>/<path>) or a passthrough Response with
  // possibly-updated cookies.
  const intlResponse = intlMiddleware(request);

  // If intl is redirecting (status 30x with a Location header), respect
  // it without running auth — auth will run on the next request after
  // the browser follows the redirect.
  if (intlResponse.headers.get("location")) {
    return intlResponse;
  }

  // Path has a locale prefix; extract it for downstream redirects.
  const match = path.match(LOCALE_PREFIX_RE);
  if (!match) {
    // Shouldn't happen — if intl didn't redirect, the path should
    // either have a prefix or not be matched by our config. Pass
    // through defensively.
    return intlResponse;
  }
  const activeLocale = match[1];
  const pathWithoutLocale = path.replace(LOCALE_PREFIX_RE, "/") || "/";

  // Step 3: Supabase session refresh + auth gate.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "middleware: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY missing",
    );
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Mirror new cookies onto the request (so getUser sees them
        // within this middleware run) and onto intlResponse (so the
        // browser stores them for the next request). We do NOT
        // recreate the response — that would drop any cookies intl
        // has already set (e.g. NEXT_LOCALE on locale change).
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          intlResponse.cookies.set(name, value, options),
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

  const isPublic = pathWithoutLocale === "/login";

  if (!user && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = `/${activeLocale}/login`;
    return preserveCookies(NextResponse.redirect(target), intlResponse);
  }

  if (user && pathWithoutLocale === "/login") {
    const target = request.nextUrl.clone();
    target.pathname = `/${activeLocale}/projects`;
    return preserveCookies(NextResponse.redirect(target), intlResponse);
  }

  return intlResponse;
}

// When we redirect, the cookies that intl + Supabase set on `source`
// would be lost on a fresh NextResponse.redirect. Copy them so the
// browser stores the new tokens — otherwise the next request comes
// in with stale cookies and we re-do the refresh round-trip.
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
  // /api/sync, /api/cron, /auth/callback are NOT excluded here — the
  // middleware function bypasses them in step 1 so the matcher stays
  // simple and the public-allowlist logic lives in one place.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
