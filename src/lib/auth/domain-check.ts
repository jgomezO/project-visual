import "server-only";

// Reads ALLOWED_EMAIL_DOMAINS as a comma-separated whitelist and returns
// whether the given email's domain is on it. Comparison is case-insensitive.
//
// Fail-closed: if the env var is unset or empty, throws. We never want to
// silently allow every domain — that would defeat the purpose of the check
// and a config bug shouldn't open the door.
export function isAllowedDomain(email: string): boolean {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS?.trim();
  if (!raw) {
    throw new Error(
      "ALLOWED_EMAIL_DOMAINS is not set. Refusing to allow any login. " +
        "Set it in .env.local (and Vercel) — see .env.example.",
    );
  }
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) {
    throw new Error(
      "ALLOWED_EMAIL_DOMAINS is empty after parsing. Refusing to allow any login.",
    );
  }

  const at = email.lastIndexOf("@");
  if (at === -1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  return allowed.includes(domain);
}
