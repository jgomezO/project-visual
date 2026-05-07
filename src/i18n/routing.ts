import { defineRouting } from "next-intl/routing";

// Single source of truth for the i18n routing contract — referenced by
// the request loader, the middleware, and the type-safe navigation
// helpers in `./navigation.ts`.
//
// `localePrefix: 'always'` means every URL the user sees in the
// address bar carries `/en` or `/es` as the first segment. Bare paths
// (`/projects`) get redirected by the middleware to the matching
// locale-prefixed URL based on cookie or default.
//
// `localeDetection: false` — we explicitly DO NOT auto-detect via the
// browser's Accept-Language header. New visitors without a
// `NEXT_LOCALE` cookie always land in English. Predictable behavior
// for external audiences receiving a shared narrative link.
export const routing = defineRouting({
  locales: ["en", "es"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
