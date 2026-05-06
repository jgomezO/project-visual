"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Label, ListBox, Select } from "@heroui/react";
import type { Key } from "@heroui/react";
import { updatePhaseAction } from "@/app/actions/narratives";
import type { NarrativePhase, PhaseStatus } from "@/lib/narratives/types";
import {
  DateInputField,
  Field,
  FormDeleteButton,
  SectionHeading,
  TextInput,
  Textarea,
} from "./form-fields";
import type { FormHandle } from "./NarrativeForm";
import { useAutoSave, type SaveState } from "./useAutoSave";

const NAME_MAX = 200;

const STATUS_OPTIONS: { id: PhaseStatus; label: string }[] = [
  { id: "upcoming", label: "Próxima" },
  { id: "in_progress", label: "En curso" },
  { id: "completed", label: "Completada" },
  { id: "at_risk", label: "En riesgo" },
];

interface PhaseFormProps {
  phase: NarrativePhase;
  onPatched: (next: NarrativePhase) => void;
  onDelete: () => void;
  pendingDelete: boolean;
  onSaveStateChange?: (state: SaveState) => void;
}

export const PhaseForm = forwardRef<FormHandle, PhaseFormProps>(
  function PhaseForm(
    { phase, onPatched, onDelete, pendingDelete, onSaveStateChange },
    ref,
  ) {
    const [draft, setDraft] = useState({
      name: phase.name,
      objective: phase.objective ?? "",
      rationale: phase.rationale ?? "",
      status: phase.status as PhaseStatus,
      progress_percent: phase.progress_percent,
      start_date: phase.start_date ?? "",
      end_date: phase.end_date ?? "",
    });

    const nameInvalid = draft.name.trim().length === 0;
    const dateOrderInvalid =
      draft.start_date !== "" &&
      draft.end_date !== "" &&
      draft.start_date > draft.end_date;
    const progressInvalid =
      draft.progress_percent !== null &&
      draft.progress_percent !== undefined &&
      (draft.progress_percent < 0 || draft.progress_percent > 100);
    const isInvalid = nameInvalid || dateOrderInvalid || progressInvalid;

    const { flush, retry } = useAutoSave(
      draft,
      async (snapshot) => {
        if (isInvalid) {
          throw new Error("Hay campos inválidos en el formulario.");
        }
        const updated = await updatePhaseAction(phase.id, {
          name: snapshot.name,
          objective: snapshot.objective || null,
          rationale: snapshot.rationale || null,
          status: snapshot.status,
          progress_percent: snapshot.progress_percent,
          start_date: snapshot.start_date || null,
          end_date: snapshot.end_date || null,
        });
        onPatched(updated);
      },
      { onStateChange: onSaveStateChange },
    );

    useImperativeHandle(ref, () => ({ flush, retry }), [flush, retry]);

    function handleStatusChange(value: Key | null): void {
      if (value === null) return;
      const next = String(value) as PhaseStatus;
      setDraft((d) => ({ ...d, status: next }));
    }

    return (
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <SectionHeading>Fase</SectionHeading>

        <Field
          label="Nombre"
          error={nameInvalid ? "El nombre es obligatorio." : undefined}
        >
          <TextInput
            value={draft.name}
            onChange={(e) =>
              setDraft({ ...draft, name: e.currentTarget.value })
            }
            maxLength={NAME_MAX}
            autoFocus
          />
        </Field>

        <Field
          label="Objetivo"
          helper="El qué — qué se busca lograr en esta fase."
        >
          <Textarea
            value={draft.objective}
            onChange={(e) =>
              setDraft({ ...draft, objective: e.currentTarget.value })
            }
            rows={3}
          />
        </Field>

        <Field
          label="Rationale"
          helper="El por qué — clave para narrativas ejecutivas."
        >
          <Textarea
            value={draft.rationale}
            onChange={(e) =>
              setDraft({ ...draft, rationale: e.currentTarget.value })
            }
            rows={3}
          />
        </Field>

        <Select
          className="w-[260px]"
          value={draft.status}
          onChange={handleStatusChange}
        >
          <Label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Estado
          </Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {STATUS_OPTIONS.map((opt) => (
                <ListBox.Item key={opt.id} id={opt.id} textValue={opt.label}>
                  {opt.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateInputField
            label="Inicio"
            value={draft.start_date}
            onChange={(v) => setDraft({ ...draft, start_date: v })}
          />
          <DateInputField
            label="Fin"
            value={draft.end_date}
            onChange={(v) => setDraft({ ...draft, end_date: v })}
            error={
              dateOrderInvalid
                ? "Debe ser igual o posterior al inicio."
                : undefined
            }
          />
        </div>

        <Field
          label="Progreso (%)"
          helper="Si lo dejás vacío, se calcula automáticamente desde los issues asociados a sus workstreams."
          error={
            progressInvalid
              ? "El progreso debe estar entre 0 y 100."
              : undefined
          }
        >
          <TextInput
            type="number"
            min={0}
            max={100}
            value={
              draft.progress_percent === null ||
              draft.progress_percent === undefined
                ? ""
                : draft.progress_percent
            }
            onChange={(e) => {
              const v = e.currentTarget.value;
              setDraft({
                ...draft,
                progress_percent: v === "" ? null : Number(v),
              });
            }}
            className="max-w-[160px]"
          />
        </Field>

        <FormDeleteButton onClick={onDelete} disabled={pendingDelete}>
          {pendingDelete ? "Eliminando…" : "Eliminar fase"}
        </FormDeleteButton>
      </form>
    );
  },
);
