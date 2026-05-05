// Display fallback for created_by / updated_by columns. NULL or the
// literal "system" string both render as "Sistema" — covers iter 4f's
// transition cleanly:
//   - Pre-auth rows: hardcoded "system" (NewNarrativeButton, seed)
//   - System paths post-auth: same hardcoded "system" (sync, scripts)
//   - User-driven rows: an email like john@veevart.com
//
// We don't strip the email domain on purpose: keeping the full address
// makes attribution unambiguous when several people share a first name.
// If a tidier display becomes important later, do it via a
// user_profiles lookup (display_name) rather than email parsing.
export function formatActor(value: string | null | undefined): string {
  if (!value || value === "system") return "Sistema";
  return value;
}
