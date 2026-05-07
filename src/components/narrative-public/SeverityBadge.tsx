import { getTranslations } from "next-intl/server";
import type { RiskSeverity } from "@/lib/narratives/types";

// Severity is curated by the PM (low / medium / high). Distinct from
// `RiskLevel` (4 buckets including "critical"), which is the *derived*
// signal used on dependency cards. Risk cards show severity directly.

// Prism palette (R4): low → neutral warm wash, medium → warning-bg
// with warm-700 chip text (warning at L=0.75 is too light for chip
// text), high → error-bg + text-error.
const SEVERITY_CLASSES: Record<RiskSeverity, string> = {
  low: "bg-warm-100 text-text-secondary",
  medium: "bg-warning-bg text-warm-700",
  high: "bg-error-bg text-error",
};

export async function SeverityBadge({ severity }: { severity: RiskSeverity }) {
  // Labels reused from the shared common.riskSeverity enum so the
  // editor's RiskForm Select and the public chip can't drift.
  const t = await getTranslations("common.riskSeverity");
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${SEVERITY_CLASSES[severity]}`}
    >
      {t(severity)}
    </span>
  );
}
