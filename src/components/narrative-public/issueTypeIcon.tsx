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
  // Translation key under `common.issueType.*`. Resolved by the consumer
  // (it may be an async Server Component or a sync Client Component, so
  // we don't pin the translator at this layer).
  key: NormalisedIssueType;
}

// Prism palette mapping (iter 4h R4 — fulfills the R2 TODO):
//   - epic     → primary-700 (lavender; an epic is the largest narrative
//                unit, so it gets the brand color)
//   - story    → success (green; positive narrative beat)
//   - task     → info (blue; operational unit)
//   - bug      → error (red)
//   - subtask  → text-muted (recessive)
//   - other    → text-muted/60 (more recessive — visually distinct from
//                subtask without introducing a second neutral)
const META: Record<NormalisedIssueType, IssueTypeMeta> = {
  epic: { Icon: Zap, iconClass: "text-primary-700", key: "epic" },
  story: { Icon: BookmarkPlus, iconClass: "text-success", key: "story" },
  task: { Icon: CheckSquare, iconClass: "text-info", key: "task" },
  bug: { Icon: Bug, iconClass: "text-error", key: "bug" },
  subtask: {
    Icon: CornerDownRight,
    iconClass: "text-text-muted",
    key: "subtask",
  },
  other: { Icon: Circle, iconClass: "text-text-muted/60", key: "other" },
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

// Pure-prop, locale-agnostic. The caller resolves `label` from
// `common.issueType.{key}` and passes it in as both the tooltip and the
// aria-label. Keeping the component prop-driven means it stays
// renderable in either Server or Client contexts without dragging
// next-intl into this layer.
export function IssueTypeIcon({
  rawType,
  label,
}: {
  rawType: string;
  label: string;
}) {
  const { Icon, iconClass } = getIssueTypeMeta(rawType);
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
