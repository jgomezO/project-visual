import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware navigation primitives. Use these everywhere instead of
// `next/link` / `next/navigation` so locale prefixes get added
// automatically:
//
//   import { Link, useRouter, usePathname, redirect } from '@/i18n/navigation';
//
// The Link automatically prepends the active locale to hrefs. The
// router's `replace({ locale: 'es' })` is what powers the language
// switcher.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
