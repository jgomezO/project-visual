import { Avatar } from "@heroui/react";

export function AssigneeCell({
  displayName,
}: {
  displayName: string | null;
}) {
  if (!displayName) {
    return (
      <div className="flex items-center gap-2">
        <Avatar size="sm">
          <Avatar.Fallback>?</Avatar.Fallback>
        </Avatar>
        <span className="text-sm text-muted">Sin asignar</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Avatar size="sm">
        <Avatar.Fallback>{getInitials(displayName)}</Avatar.Fallback>
      </Avatar>
      <span className="text-sm">{displayName}</span>
    </div>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
