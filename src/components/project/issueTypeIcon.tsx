import {
  BookmarkPlus,
  Bug,
  CheckSquare,
  Circle,
  CornerDownRight,
  Zap,
  type LucideIcon,
} from "lucide-react";

// Project-table flavour of the issue-type icon helper. Distinct from
// narrative-public/issueTypeIcon.tsx — that one uses raw Tailwind
// colors (the public preview is iter R4 territory). This one uses
// Prism functional tokens so the icons line up with the rest of the
// /projects/[key] palette.
export interface TypeMeta {
  Icon: LucideIcon;
  colorClass: string;
  label: string;
}

const FALLBACK: TypeMeta = {
  Icon: Circle,
  colorClass: "text-text-muted",
  label: "Otro",
};

export function getIssueTypeMeta(rawType: string | null | undefined): TypeMeta {
  const t = (rawType ?? "").trim().toLowerCase();
  if (t === "epic" || t === "épica" || t === "epica") {
    return { Icon: Zap, colorClass: "text-primary-600", label: "Épica" };
  }
  if (t === "story" || t === "historia" || t === "user story") {
    return { Icon: BookmarkPlus, colorClass: "text-success", label: "Historia" };
  }
  if (t === "task" || t === "tarea") {
    return { Icon: CheckSquare, colorClass: "text-info", label: "Tarea" };
  }
  if (t === "bug") {
    return { Icon: Bug, colorClass: "text-error", label: "Bug" };
  }
  if (
    t === "sub-task" ||
    t === "subtask" ||
    t === "sub task" ||
    t === "subtarea"
  ) {
    return {
      Icon: CornerDownRight,
      colorClass: "text-text-muted",
      label: "Subtarea",
    };
  }
  return FALLBACK;
}
