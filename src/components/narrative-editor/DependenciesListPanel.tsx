"use client";

import { Button } from "@heroui/react";
import { ChevronRight, Trash2 } from "lucide-react";
import type {
  NarrativeDependency,
  NarrativeWithChildren,
} from "@/lib/narratives/types";

const STATUS_LABEL: Record<string, string> = {
  proposed: "Propuesto",
  agreed: "Acordado",
  confirmed: "Confirmado",
  at_risk: "En riesgo",
  blocked: "Bloqueado",
};

interface Props {
  tree: NarrativeWithChildren;
  pending: boolean;
  onDeleteDependency: (dep: NarrativeDependency) => void;
}

export function DependenciesListPanel({
  tree,
  pending,
  onDeleteDependency,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Dependencias de la narrativa
        </h2>
        <p className="text-sm text-muted">
          Compromisos cross-team que afectan la entrega del proyecto. Para
          agregar, usá el botón “Agregar dependencia” en la barra lateral.
        </p>
      </header>

      {tree.dependencies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-default-300 bg-default-50 px-4 py-8 text-center text-sm text-muted">
          Esta narrativa todavía no tiene dependencias. Agregá la primera
          desde el panel izquierdo.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tree.dependencies.map((dep) => (
            <li key={dep.id}>
              <DependencyListItem
                dep={dep}
                pending={pending}
                onDelete={() => onDeleteDependency(dep)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DependencyListItem({
  dep,
  pending,
  onDelete,
}: {
  dep: NarrativeDependency;
  pending: boolean;
  onDelete: () => void;
}) {
  const statusLabel = STATUS_LABEL[dep.commitment_status] ?? dep.commitment_status;
  return (
    <div className="flex items-center gap-3 rounded-md border border-default-200 bg-surface px-3 py-2.5">
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">{dep.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          {dep.provider_pod ? <span>{dep.provider_pod}</span> : null}
          {dep.provider_pod ? <span aria-hidden="true">·</span> : null}
          <span>{statusLabel}</span>
          {dep.provider_jira_issue_keys.length > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {dep.provider_jira_issue_keys.length} issue
                {dep.provider_jira_issue_keys.length === 1 ? "" : "s"}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        isDisabled={pending}
        onPress={onDelete}
        aria-label={`Eliminar ${dep.title}`}
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
