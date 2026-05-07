// Type augmentation for next-intl. Declares the shape of `IntlMessages`
// from the *English* JSON tree (the source of truth — see CLAUDE.md
// i18n architecture). Keys present in en/* but missing in es/* will
// not type-error here; that's caught at runtime by next-intl's
// fallback warnings instead. Worth living with: forcing both locales
// to compile-time-match would block translation work.
//
// Each domain JSON file is intersected so calling
// `useTranslations('topbar.brand')` autocompletes against the merged
// shape that NextIntlClientProvider serves.

import type messages from "./messages/en.d.ts";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends messages {}
}

export {};
