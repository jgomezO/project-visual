// Custom avatar circle (iter 4h R2) — drops HeroUI Avatar in favor of
// the same lavender-on-primary-100 swatch ProjectCard uses on
// /projects, so the two surfaces share an avatar vocabulary.
export function AssigneeCell({
  displayName,
}: {
  displayName: string | null;
}) {
  if (!displayName) {
    return (
      <div className="flex items-center gap-2">
        <Circle initials="?" muted />
        <span className="text-sm text-text-muted">Sin asignar</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Circle initials={getInitials(displayName)} />
      <span className="text-sm text-text-primary">{displayName}</span>
    </div>
  );
}

function Circle({ initials, muted }: { initials: string; muted?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={
        muted
          ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-warm-100 text-xs font-semibold text-text-muted"
          : "flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700"
      }
    >
      {initials}
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
