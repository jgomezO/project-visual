"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Handshake,
  Lock,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { useTranslations } from "next-intl";
import type { CommitmentStatus } from "@/lib/narratives/types";

interface Variant {
  bg: string;
  text: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

// Prism palette mapping (R4):
//   - proposed  → neutral (warm-100 + text-secondary; the dependency
//                 hasn't been agreed yet)
//   - agreed    → info (blue; verbal handshake exists)
//   - confirmed → success (green; firm commitment)
//   - at_risk   → warning + warm-700 chip text (warning at L=0.75 is
//                 too light for chip text on warning-bg)
//   - blocked   → error (red; the strongest negative signal)
const VARIANTS: Record<CommitmentStatus, Variant> = {
  proposed: {
    bg: "bg-warm-100",
    text: "text-text-secondary",
    Icon: CircleDashed,
  },
  agreed: {
    bg: "bg-info-bg",
    text: "text-info",
    Icon: Handshake,
  },
  confirmed: {
    bg: "bg-success-bg",
    text: "text-success",
    Icon: CheckCircle2,
  },
  at_risk: {
    bg: "bg-warning-bg",
    text: "text-warm-700",
    Icon: AlertTriangle,
  },
  blocked: {
    bg: "bg-error-bg",
    text: "text-error",
    Icon: Lock,
  },
};

/**
 * Visual chip for narrative_dependency.commitment_status. Distinct from
 * StatusChip in components/project/ — that one represents Jira issue
 * status_category ("To Do" | "In Progress" | "Done"). Mixing the two
 * would conflate two different domains.
 *
 * "use client" because the chip is rendered inside DependencyCard (a
 * Client Component) and the label is resolved via the shared
 * common.commitmentStatus enum — same source the editor's
 * DependencyForm Select uses, so the two views can't drift.
 */
export function CommitmentStatusChip({ status }: { status: CommitmentStatus }) {
  const t = useTranslations("common.commitmentStatus");
  const v = VARIANTS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${v.bg} ${v.text}`}
    >
      <v.Icon className="size-3.5" aria-hidden="true" />
      {t(status)}
    </span>
  );
}
