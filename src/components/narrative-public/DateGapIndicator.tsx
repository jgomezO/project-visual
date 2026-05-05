import { AlertTriangle, Calendar, CheckCircle2 } from "lucide-react";

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
 * - delay > 0      → red, "⚠ X días de retraso esperado"
 * - delay === 0    → green, "✓ Justo a tiempo"
 * - delay < 0      → green, "✓ X días de margen"
 *
 * When delayRiskDays is null we fall back to a single neutral chip if
 * one of the dates is present (so the reader still sees what's known),
 * otherwise we render nothing.
 */
export function DateGapIndicator({
  delayRiskDays,
  neededDate,
  expectedDate,
}: Props) {
  if (delayRiskDays === null) {
    if (neededDate) {
      return (
        <Chip tone="neutral">
          <Calendar className="size-3.5" aria-hidden="true" />
          Necesario antes del {formatDate(neededDate)}
        </Chip>
      );
    }
    if (expectedDate) {
      return (
        <Chip tone="neutral">
          <Calendar className="size-3.5" aria-hidden="true" />
          Entrega esperada el {formatDate(expectedDate)}
        </Chip>
      );
    }
    return null;
  }

  if (delayRiskDays > 0) {
    return (
      <Chip tone="danger">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        {delayRiskDays} día{delayRiskDays === 1 ? "" : "s"} de retraso esperado
      </Chip>
    );
  }
  if (delayRiskDays === 0) {
    return (
      <Chip tone="success">
        <CheckCircle2 className="size-3.5" aria-hidden="true" />
        Justo a tiempo
      </Chip>
    );
  }
  const margin = -delayRiskDays;
  return (
    <Chip tone="success">
      <CheckCircle2 className="size-3.5" aria-hidden="true" />
      {margin} día{margin === 1 ? "" : "s"} de margen
    </Chip>
  );
}

type ChipTone = "neutral" | "success" | "danger";

const TONE_STYLES: Record<ChipTone, string> = {
  neutral: "bg-default-100 text-foreground",
  success: "bg-emerald-100 text-emerald-800",
  danger: "bg-red-100 text-red-800",
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

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
