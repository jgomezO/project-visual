import {
  BookmarkPlus,
  Bug,
  CheckSquare,
  Circle,
  CornerDownRight,
  Zap,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

// Normalised internal type. Jira workflows can rename / translate the
// raw `issue_type` string (e.g. "Historia" instead of "Story", or
// "Sub-task" with the hyphen elided), so we lower-case + trim and route
// every variant we've seen back to one of these five buckets.
type NormalisedIssueType = "epic" | "story" | "task" | "bug" | "subtask" | "other";

interface IssueTypeMeta {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClass: string;
  label: string;
}

const META: Record<NormalisedIssueType, IssueTypeMeta> = {
  epic: { Icon: Zap, iconClass: "text-purple-700", label: "Épica" },
  story: { Icon: BookmarkPlus, iconClass: "text-green-700", label: "Historia" },
  task: { Icon: CheckSquare, iconClass: "text-blue-700", label: "Tarea" },
  bug: { Icon: Bug, iconClass: "text-red-700", label: "Bug" },
  subtask: {
    Icon: CornerDownRight,
    iconClass: "text-gray-500",
    label: "Subtarea",
  },
  other: { Icon: Circle, iconClass: "text-gray-400", label: "Otro" },
};

function normalise(raw: string): NormalisedIssueType {
  const v = raw.trim().toLowerCase();
  if (v === "epic" || v === "epica" || v === "épica") return "epic";
  if (v === "story" || v === "historia") return "story";
  if (v === "task" || v === "tarea") return "task";
  if (v === "bug" || v === "defect") return "bug";
  // Sub-task / Subtask / Sub task / Subtarea — the dash and the noun
  // both come and go across Jira instances.
  if (/^sub[\s\-]?task$/.test(v) || v === "subtarea") return "subtask";
  return "other";
}

export function getIssueTypeMeta(rawType: string): IssueTypeMeta {
  return META[normalise(rawType)];
}

// Server-renderable: just an inline span with the icon + a `title`
// attribute for tooltip-on-hover. Pure presentation, no client JS.
export function IssueTypeIcon({ rawType }: { rawType: string }) {
  const { Icon, iconClass, label } = getIssueTypeMeta(rawType);
  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex shrink-0 items-center ${iconClass}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
