"use client";

import { GeistMono } from "geist/font/mono";
import { Button } from "@heroui/react";
import { ChevronRight, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  NarrativeRisk,
  NarrativeWithChildren,
} from "@/lib/narratives/types";
import { SectionHeading } from "./form-fields";

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
  const t = useTranslations("narratives.editor.risksList");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <SectionHeading>{t("heading")}</SectionHeading>
        <p className="text-sm text-text-secondary">{t("description")}</p>
      </header>

      {tree.risks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-text-secondary">
          {t("empty")}
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
  const tSeverity = useTranslations("common.riskSeverity");
  const tCard = useTranslations("narratives.editor.risksList.card");
  const validKeys = ["low", "medium", "high"] as const;
  const severityLabel = (validKeys as readonly string[]).includes(risk.severity)
    ? tSeverity(risk.severity as "low" | "medium" | "high")
    : risk.severity;
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-warm-50">
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 flex-col items-start gap-0.5 text-left"
      >
        <span className="flex items-center gap-2">
          <span
            className={`${GeistMono.className} rounded-full bg-warm-100 px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary`}
          >
            {risk.identifier}
          </span>
          <span className="text-sm font-medium text-text-primary">
            {risk.title}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary">
          <span>{tCard("severityLabel", { label: severityLabel })}</span>
          <span aria-hidden="true" className="text-text-muted">
            ·
          </span>
          <span>{tCard("impactsCount", { count: risk.impacts.length })}</span>
          <span aria-hidden="true" className="text-text-muted">
            ·
          </span>
          <span>
            {tCard("mitigationsCount", { count: risk.mitigations.length })}
          </span>
        </span>
      </button>
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        isDisabled={pending}
        onPress={onDelete}
        aria-label={tCard("deleteAria", { title: risk.title })}
        className="text-error opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
      <ChevronRight
        className="size-4 text-text-muted"
        aria-hidden="true"
      />
    </div>
  );
}
