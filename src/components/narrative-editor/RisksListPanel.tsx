"use client";

import { Button } from "@heroui/react";
import { ChevronRight, Trash2 } from "lucide-react";
import type {
  NarrativeRisk,
  NarrativeWithChildren,
} from "@/lib/narratives/types";

const SEVERITY_LABEL: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

interface Props {
  tree: NarrativeWithChildren;
  pending: boolean;
  onSelectRisk: (id: string) => void;
  onDeleteRisk: (risk: NarrativeRisk) => void;
}

export function RisksListPanel({
  tree,
  pending,
  onSelectRisk,
  onDeleteRisk,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Riesgos del proyecto
        </h2>
        <p className="text-sm text-muted">
          Riesgos declarados a nivel narrativa, con sus impactos y mitigaciones.
          Para agregar, usá el botón “Agregar riesgo” en la barra lateral.
        </p>
      </header>

      {tree.risks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-default-300 bg-default-50 px-4 py-8 text-center text-sm text-muted">
          Esta narrativa todavía no tiene riesgos. Agregá el primero desde el
          panel izquierdo.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tree.risks.map((risk) => (
            <li key={risk.id}>
              <RiskListItem
                risk={risk}
                pending={pending}
                onSelect={() => onSelectRisk(risk.id)}
                onDelete={() => onDeleteRisk(risk)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RiskListItem({
  risk,
  pending,
  onSelect,
  onDelete,
}: {
  risk: NarrativeRisk;
  pending: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const severityLabel = SEVERITY_LABEL[risk.severity] ?? risk.severity;
  return (
    <div className="flex items-center gap-3 rounded-md border border-default-200 bg-surface px-3 py-2.5 hover:bg-default-50">
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 flex-col items-start gap-0.5 text-left"
      >
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-default-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
            {risk.identifier}
          </span>
          <span className="text-sm font-medium text-foreground">
            {risk.title}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span>Severidad: {severityLabel}</span>
          <span aria-hidden="true">·</span>
          <span>
            {risk.impacts.length} impacto{risk.impacts.length === 1 ? "" : "s"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {risk.mitigations.length} mitigaci
            {risk.mitigations.length === 1 ? "ón" : "ones"}
          </span>
        </span>
      </button>
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        isDisabled={pending}
        onPress={onDelete}
        aria-label={`Eliminar ${risk.title}`}
        className="text-danger"
      >
        <Trash2 className="size-4" />
      </Button>
      <ChevronRight
        className="size-4 text-default-300"
        aria-hidden="true"
      />
    </div>
  );
}
