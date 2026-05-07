"use client";

import { Button } from "@heroui/react";
import { ChevronRight, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type {
  NarrativeDependency,
  NarrativeWithChildren,
} from "@/lib/narratives/types";
import { SectionHeading } from "./form-fields";

interface Props {
  tree: NarrativeWithChildren;
  pending: boolean;
  onSelectDependency: (id: string) => void;
  onDeleteDependency: (dep: NarrativeDependency) => void;
}

export function DependenciesListPanel({
  tree,
  pending,
  onSelectDependency,
  onDeleteDependency,
}: Props) {
  const t = useTranslations("narratives.editor.dependenciesList");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <SectionHeading>{t("heading")}</SectionHeading>
        <p className="text-sm text-text-secondary">{t("description")}</p>
      </header>

      {tree.dependencies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-text-secondary">
          {t("empty")}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {tree.dependencies.map((dep) => (
            <li key={dep.id}>
              <DependencyListItem
                dep={dep}
                pending={pending}
                onSelect={() => onSelectDependency(dep.id)}
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
  onSelect,
  onDelete,
}: {
  dep: NarrativeDependency;
  pending: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const tCommitment = useTranslations("common.commitmentStatus");
  const tCard = useTranslations("narratives.editor.dependenciesList.card");
  const statusKey = dep.commitment_status as
    | "proposed"
    | "agreed"
    | "confirmed"
    | "at_risk"
    | "blocked";
  // Defensive — if a future enum value sneaks in, fall back to the raw
  // value so the row is still readable.
  const validKeys = ["proposed", "agreed", "confirmed", "at_risk", "blocked"];
  const statusLabel = validKeys.includes(dep.commitment_status)
    ? tCommitment(statusKey)
    : dep.commitment_status;
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-warm-50">
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 flex-col items-start gap-0.5 text-left"
      >
        <span className="text-sm font-medium text-text-primary">
          {dep.title}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary">
          {dep.provider_pod ? <span>{dep.provider_pod}</span> : null}
          {dep.provider_pod ? (
            <span aria-hidden="true" className="text-text-muted">
              ·
            </span>
          ) : null}
          <span>{statusLabel}</span>
          {dep.provider_jira_issue_keys.length > 0 ? (
            <>
              <span aria-hidden="true" className="text-text-muted">
                ·
              </span>
              <span>
                {tCard("issuesCount", {
                  count: dep.provider_jira_issue_keys.length,
                })}
              </span>
            </>
          ) : null}
        </span>
      </button>
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        isDisabled={pending}
        onPress={onDelete}
        aria-label={tCard("deleteAria", { title: dep.title })}
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
