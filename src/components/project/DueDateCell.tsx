"use client";

import { useFormatter } from "next-intl";

// iter 5 (i18n): drops the hardcoded `Intl.DateTimeFormat("es-AR")`
// in favor of next-intl's `useFormatter().dateTime`, which respects
// the active locale (so en sees "May 12", es sees "12 may."). Same
// year-aware switch — without year when current, with year otherwise.
// Becomes "use client" because useFormatter is a hook; only Client
// components consume DueDateCell today, so no new boundary.
export function DueDateCell({
  date,
  isDone,
}: {
  date: string | null;
  isDone: boolean;
}) {
  const format = useFormatter();
  if (!date) {
    return <span className="text-sm text-text-muted">—</span>;
  }
  // due_date arrives as 'yyyy-MM-dd' (a DATE); parse as local midnight to
  // avoid TZ shifts that would push the day around.
  const d = new Date(`${date}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((d.getTime() - today.getTime()) / dayMs);

  // Functional palette (iter 4h R2): overdue = error, ≤7d = warning,
  // future = neutral text, done = muted (the date is informational
  // not actionable once the issue is resolved).
  let colorClass = "text-text-primary";
  if (isDone) {
    colorClass = "text-text-muted";
  } else if (diffDays < 0) {
    colorClass = "text-error font-medium";
  } else if (diffDays <= 7) {
    colorClass = "text-warning";
  }

  const sameYear = d.getFullYear() === now.getFullYear();
  const formatted = format.dateTime(d, {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });

  return (
    <span className={`text-sm tabular-nums ${colorClass}`}>{formatted}</span>
  );
}
