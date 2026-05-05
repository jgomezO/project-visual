import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Handshake,
  Lock,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import type { CommitmentStatus } from "@/lib/narratives/types";

interface Variant {
  label: string;
  bg: string;
  text: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const VARIANTS: Record<CommitmentStatus, Variant> = {
  proposed: {
    label: "Propuesto",
    bg: "bg-default-100",
    text: "text-default-700",
    Icon: CircleDashed,
  },
  agreed: {
    label: "Acordado",
    bg: "bg-blue-100",
    text: "text-blue-700",
    Icon: Handshake,
  },
  confirmed: {
    label: "Confirmado",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    Icon: CheckCircle2,
  },
  at_risk: {
    label: "En riesgo",
    bg: "bg-orange-100",
    text: "text-orange-800",
    Icon: AlertTriangle,
  },
  blocked: {
    label: "Bloqueado",
    bg: "bg-red-100",
    text: "text-red-800",
    Icon: Lock,
  },
};

/**
 * Visual chip for narrative_dependency.commitment_status. Distinct from
 * StatusChip in components/project/ — that one represents Jira issue
 * status_category ("To Do" | "In Progress" | "Done"). Mixing the two
 * would conflate two different domains.
 */
export function CommitmentStatusChip({ status }: { status: CommitmentStatus }) {
  const v = VARIANTS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${v.bg} ${v.text}`}
    >
      <v.Icon className="size-3.5" aria-hidden="true" />
      {v.label}
    </span>
  );
}
