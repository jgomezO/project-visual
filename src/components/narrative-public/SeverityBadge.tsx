import type { RiskSeverity } from "@/lib/narratives/types";

// Severity is curated by the PM (low / medium / high). Distinct from
// `RiskLevel` (4 buckets including "critical"), which is the *derived*
// signal used on dependency cards. Risk cards show severity directly.

const SEVERITY_LABEL_ES: Record<RiskSeverity, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

const SEVERITY_CLASSES: Record<RiskSeverity, string> = {
  low: "bg-default-100 text-foreground",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-red-100 text-red-800",
};

export function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[severity]}`}
    >
      {SEVERITY_LABEL_ES[severity]}
    </span>
  );
}
