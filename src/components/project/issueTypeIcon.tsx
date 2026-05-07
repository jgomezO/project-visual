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
//
// iter 5 (i18n): the helper no longer carries a hardcoded Spanish
// `label`. It returns a `key` (one of six normalised buckets) and the
// caller resolves the localised label via `t(\`common.issueType.${key}\`)`.
// Keeps the helper pure and locale-agnostic so it stays unit-testable
// and Server / Client components share the same shape.

export type NormalisedIssueType =
  | "epic"
  | "story"
  | "task"
  | "bug"
  | "subtask"
  | "other";

export interface TypeMeta {
  Icon: LucideIcon;
  colorClass: string;
  key: NormalisedIssueType;
}

const FALLBACK: TypeMeta = {
  Icon: Circle,
  colorClass: "text-text-muted",
  key: "other",
};

export function getIssueTypeMeta(rawType: string | null | undefined): TypeMeta {
  const t = (rawType ?? "").trim().toLowerCase();
  if (t === "epic" || t === "épica" || t === "epica") {
    return { Icon: Zap, colorClass: "text-primary-600", key: "epic" };
  }
  if (t === "story" || t === "historia" || t === "user story") {
    return { Icon: BookmarkPlus, colorClass: "text-success", key: "story" };
  }
  if (t === "task" || t === "tarea") {
    return { Icon: CheckSquare, colorClass: "text-info", key: "task" };
  }
  if (t === "bug") {
    return { Icon: Bug, colorClass: "text-error", key: "bug" };
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
      key: "subtask",
    };
  }
  return FALLBACK;
}
