// Date helpers for the roadmap view. All dates are interpreted as UTC
// midnight to keep `date → x` math TZ-independent (Jira gives YYYY-MM-DD
// for due_date / start_date — date-only, no time).

export const DAY_MS = 24 * 60 * 60 * 1000;

export function parseISODate(iso: string): Date {
  // 'YYYY-MM-DD' → UTC midnight Date.
  return new Date(`${iso}T00:00:00Z`);
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayUTC(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function addMonthsUTC(d: Date, months: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()),
  );
}

export function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

export function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function endOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

export function startOfQuarterUTC(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
}

export function endOfQuarterUTC(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3 + 3, 0));
}

// Mondays as the week boundary (ISO 8601). getUTCDay returns 0 for Sun.
export function startOfWeekUTC(d: Date): Date {
  const day = d.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return new Date(d.getTime() + offset * DAY_MS);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function dateToX(
  date: Date,
  from: Date,
  to: Date,
  chartWidth: number,
): number {
  const totalMs = to.getTime() - from.getTime();
  if (totalMs <= 0) return 0;
  const offsetMs = date.getTime() - from.getTime();
  return (offsetMs / totalMs) * chartWidth;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(s: string | undefined): s is string {
  if (!s || !ISO_DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

// iter 5 (i18n): formatMonthLabel + formatShortDate were removed.
// They hardcoded `Intl.DateTimeFormat("es-AR")`; consumers now call
// `useFormatter().dateTime` from next-intl so the label respects the
// active locale ("May 2026" / "may. 2026"). The math helpers above
// stay — they're locale-agnostic.
