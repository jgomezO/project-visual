"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { GeistMono } from "geist/font/mono";
import { Label, ListBox, Select } from "@heroui/react";
import type { Key } from "@heroui/react";
import { updateRiskAction } from "@/app/actions/narratives";
import type {
  NarrativeDependency,
  NarrativeRisk,
  RiskSeverity,
} from "@/lib/narratives/types";
import { BulletListInput } from "./BulletListInput";
import {
  Field,
  FormDeleteButton,
  SectionHeading,
  TextInput,
  Textarea,
} from "./form-fields";
import type { FormHandle } from "./NarrativeForm";
import { useAutoSave, type SaveState } from "./useAutoSave";

const TITLE_MAX = 200;

const SEVERITY_OPTIONS: { id: RiskSeverity; label: string }[] = [
  { id: "low", label: "Baja" },
  { id: "medium", label: "Media" },
  { id: "high", label: "Alta" },
];

interface RiskFormProps {
  risk: NarrativeRisk;
  // The narrative's dependencies — used to render the related-dependencies
  // toggle list. We don't autocomplete: deps per narrative are bounded
  // (single digits in practice), so a static toggle list is faster to use.
  dependencies: NarrativeDependency[];
  onPatched: (next: NarrativeRisk) => void;
  onDelete: () => void;
  pendingDelete: boolean;
  onSaveStateChange?: (state: SaveState) => void;
}

export const RiskForm = forwardRef<FormHandle, RiskFormProps>(
  function RiskForm(
    {
      risk,
      dependencies,
      onPatched,
      onDelete,
      pendingDelete,
      onSaveStateChange,
    },
    ref,
  ) {
    const [draft, setDraft] = useState({
      title: risk.title,
      description: risk.description ?? "",
      severity: risk.severity as RiskSeverity,
      // BulletListInput allows empty strings during typing; we trim+filter
      // at save time and surface errors via the bullet list errorMessage.
      impacts: risk.impacts.length > 0 ? risk.impacts : [""],
      mitigations: risk.mitigations.length > 0 ? risk.mitigations : [""],
      related_dependency_ids: risk.related_dependency_ids,
    });

    const cleanedImpacts = draft.impacts.map((s) => s.trim()).filter(Boolean);
    const cleanedMitigations = draft.mitigations
      .map((s) => s.trim())
      .filter(Boolean);

    const titleInvalid = draft.title.trim().length === 0;
    const impactsInvalid = cleanedImpacts.length === 0;
    const mitigationsInvalid = cleanedMitigations.length === 0;
    const isInvalid = titleInvalid || impactsInvalid || mitigationsInvalid;

    const { flush, retry } = useAutoSave(
      draft,
      async () => {
        if (isInvalid) {
          throw new Error(
            "Riesgo inválido: revisá título, impactos y mitigaciones.",
          );
        }
        const updated = await updateRiskAction(risk.id, {
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          severity: draft.severity,
          impacts: cleanedImpacts,
          mitigations: cleanedMitigations,
          related_dependency_ids: draft.related_dependency_ids,
        });
        onPatched(updated);
      },
      { onStateChange: onSaveStateChange },
    );

    useImperativeHandle(ref, () => ({ flush, retry }), [flush, retry]);

    function handleSeverityChange(value: Key | null): void {
      if (value === null) return;
      setDraft((d) => ({ ...d, severity: String(value) as RiskSeverity }));
    }

    function toggleDependency(depId: string): void {
      setDraft((d) => {
        const has = d.related_dependency_ids.includes(depId);
        return {
          ...d,
          related_dependency_ids: has
            ? d.related_dependency_ids.filter((id) => id !== depId)
            : [...d.related_dependency_ids, depId],
        };
      });
    }

    return (
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <header className="flex items-center gap-2">
          <SectionHeading>Riesgo</SectionHeading>
          <span
            className={`${GeistMono.className} rounded-full bg-warm-100 px-2 py-0.5 text-[10px] font-semibold text-text-secondary`}
          >
            {risk.identifier}
          </span>
        </header>

        <Field
          label="Título"
          error={titleInvalid ? "El título es obligatorio." : undefined}
        >
          <TextInput
            value={draft.title}
            onChange={(e) =>
              setDraft({ ...draft, title: e.currentTarget.value })
            }
            maxLength={TITLE_MAX}
            autoFocus
          />
        </Field>

        <Field label="Descripción">
          <Textarea
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.currentTarget.value })
            }
            rows={3}
            placeholder="¿Qué riesgo es y por qué nos preocupa?"
          />
        </Field>

        <Select
          className="w-[200px]"
          value={draft.severity}
          onChange={handleSeverityChange}
        >
          <Label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Severidad
          </Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {SEVERITY_OPTIONS.map((opt) => (
                <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                  {opt.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <BulletListInput
          label="Impactos"
          value={draft.impacts}
          onChange={(next) => setDraft({ ...draft, impacts: next })}
          placeholder="Describí un impacto…"
          tone="danger"
          errorMessage={impactsInvalid ? "Mínimo un impacto no vacío." : null}
        />

        <BulletListInput
          label="Mitigaciones"
          value={draft.mitigations}
          onChange={(next) => setDraft({ ...draft, mitigations: next })}
          placeholder="Describí una mitigación…"
          tone="success"
          errorMessage={
            mitigationsInvalid ? "Mínimo una mitigación no vacía." : null
          }
        />

        <RelatedDependenciesPicker
          dependencies={dependencies}
          selected={draft.related_dependency_ids}
          onToggle={toggleDependency}
        />

        <FormDeleteButton onClick={onDelete} disabled={pendingDelete}>
          {pendingDelete ? "Eliminando…" : "Eliminar riesgo"}
        </FormDeleteButton>
      </form>
    );
  },
);

function RelatedDependenciesPicker({
  dependencies,
  selected,
  onToggle,
}: {
  dependencies: NarrativeDependency[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (dependencies.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          Dependencias relacionadas
        </span>
        <p className="text-sm italic text-text-muted">
          Esta narrativa todavía no tiene dependencias para vincular.
        </p>
      </div>
    );
  }

  const selectedSet = new Set(selected);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        Dependencias relacionadas
      </span>
      <p className="text-sm text-text-secondary">
        Marcá las dependencias afectadas por este riesgo. Aparecerán
        linkeadas en la vista pública.
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {dependencies.map((dep) => {
          const isOn = selectedSet.has(dep.id);
          return (
            <li key={dep.id}>
              <button
                type="button"
                onClick={() => onToggle(dep.id)}
                aria-pressed={isOn}
                className={
                  isOn
                    ? "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-primary-600"
                    : "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-warm-50"
                }
              >
                <span
                  className={`${GeistMono.className} text-[10px] ${isOn ? "opacity-80" : "text-text-muted"}`}
                >
                  {dep.identifier}
                </span>
                <span className="max-w-[12rem] truncate">{dep.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
