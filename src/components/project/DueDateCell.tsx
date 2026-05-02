const SHORT = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
});
const WITH_YEAR = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function DueDateCell({
  date,
  isDone,
}: {
  date: string | null;
  isDone: boolean;
}) {
  if (!date) {
    return <span className="text-sm text-muted">—</span>;
  }
  // due_date arrives as 'yyyy-MM-dd' (a DATE); parse as local midnight to
  // avoid TZ shifts that would push the day around.
  const d = new Date(`${date}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((d.getTime() - today.getTime()) / dayMs);

  let colorClass = "text-foreground";
  if (isDone) {
    colorClass = "text-muted";
  } else if (diffDays < 0) {
    colorClass = "text-danger";
  } else if (diffDays <= 7) {
    colorClass = "text-amber-600";
  }

  const formatter = d.getFullYear() === now.getFullYear() ? SHORT : WITH_YEAR;
  return <span className={`text-sm ${colorClass}`}>{formatter.format(d)}</span>;
}
