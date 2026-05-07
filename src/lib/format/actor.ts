// Display fallback for created_by / updated_by columns. NULL or the
// literal "system" string both render as the localized "System" label —
// covers iter 4f's transition cleanly:
//   - Pre-auth rows: hardcoded "system" (NewNarrativeButton, seed)
//   - System paths post-auth: same hardcoded "system" (sync, scripts)
//   - User-driven rows: an email like john@veevart.com
//
// We don't strip the email domain on purpose: keeping the full address
// makes attribution unambiguous when several people share a first name.
// If a tidier display becomes important later, do it via a
// user_profiles lookup (display_name) rather than email parsing.
//
// iter 5 (i18n): no longer pure — needs the locale-aware "System"
// label. Two flavors: `formatActor(value, t)` for callers that already
// have a translator (the common case in editor / list components),
// and `formatActorRaw(value)` that returns the raw value or null,
// letting the caller decide what to render for system rows when they
// can't depend on next-intl context.

type Translator = (key: "system") => string;

export function formatActor(
  value: string | null | undefined,
  t: Translator,
): string {
  if (!value || value === "system") return t("system");
  return value;
}

// Raw form for paths that don't have a next-intl context (CLI scripts,
// SSR boundaries that haven't called setRequestLocale, tests). Returns
// null when the row should be displayed as "System" — the caller picks
// the label.
export function formatActorRaw(
  value: string | null | undefined,
): string | null {
  if (!value || value === "system") return null;
  return value;
}
