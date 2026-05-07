"use client";

import { AlertTriangle, Calendar, CheckCircle2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

interface Props {
  delayRiskDays: number | null;
  // For when the consumer wants to surface the standalone "necesario antes
  // del X" / "entrega esperada el X" chip even when the gap can't be
  // computed (one of the dates is missing).
  neededDate?: string | null;
  expectedDate?: string | null;
}

/**
 * The card-level "is this on time?" chip. Three modes:
 * - delay > 0      → red, "{N} days of expected delay"
 * - delay === 0    → green, "Right on time"
 * - delay < 0      → green, "{N} days of margin"
 *
 * When delayRiskDays is null we fall back to a single neutral chip if
 * one of the dates is present (so the reader still sees what's known),
 * otherwise we render nothing.
 *
 * "use client" because both numeric chips use ICU plural messages and
 * the date fallback chips route through useFormatter — both APIs are
 * client-only. The only consumer (DependencyCard) is already a client
 * component, so this doesn't add a server/client boundary.
 */
export function DateGapIndicator({
  delayRiskDays,
  neededDate,
  expectedDate,
}: Props) {
  const t = useTranslations("preview.dateGap");
  const format = useFormatter();

  const formatIsoDate = (iso: string): string => {
    const [y, m, d] = iso.split("-").map(Number);
    return format.dateTime(new Date(Date.UTC(y, m - 1, d)), {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  if (delayRiskDays === null) {
    if (neededDate) {
      return (
        <Chip tone="neutral">
          <Calendar className="size-3.5" aria-hidden="true" />
          {t("neededBy", { date: formatIsoDate(neededDate) })}
        </Chip>
      );
    }
    if (expectedDate) {
      return (
        <Chip tone="neutral">
          <Calendar className="size-3.5" aria-hidden="true" />
          {t("expectedOn", { date: formatIsoDate(expectedDate) })}
        </Chip>
      );
    }
    return null;
  }

  if (delayRiskDays > 0) {
    return (
      <Chip tone="danger">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        {t("delay", { count: delayRiskDays })}
      </Chip>
    );
  }
  if (delayRiskDays === 0) {
    return (
      <Chip tone="success">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        {t("onTime")}
      </Chip>
    );
  }
  const margin = -delayRiskDays;
  return (
    <Chip tone="success">
      <CheckCircle2 className="size-3.5" aria-hidden="true" />
      {t("margin", { count: margin })}
    </Chip>
  );
}

type ChipTone = "neutral" | "success" | "danger";

const TONE_STYLES: Record<ChipTone, string> = {
  neutral: "bg-warm-100 text-text-primary",
  success: "bg-success-bg text-success",
  danger: "bg-error-bg text-error",
};

function Chip({
  tone,
  children,
}: {
  tone: ChipTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${TONE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}
