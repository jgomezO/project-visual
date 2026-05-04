"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import { updatePhaseAction } from "@/app/actions/narratives";
import type { NarrativePhase, PhaseStatus } from "@/lib/narratives/types";

const NAME_MAX = 200;

const STATUS_OPTIONS: { id: PhaseStatus; label: string }[] = [
  { id: "upcoming", label: "Próxima" },
  { id: "in_progress", label: "En curso" },
  { id: "completed", label: "Completada" },
  { id: "at_risk", label: "En riesgo" },
];

export function PhaseForm({
  phase,
  onPatched,
  onDelete,
  pendingDelete,
}: {
  phase: NarrativePhase;
  onPatched: (next: NarrativePhase) => void;
  onDelete: () => void;
  pendingDelete: boolean;
}) {
  const [draft, setDraft] = useState({
    name: phase.name,
    objective: phase.objective ?? "",
    rationale: phase.rationale ?? "",
    status: phase.status as PhaseStatus,
    progress_percent: phase.progress_percent,
    start_date: phase.start_date ?? "",
    end_date: phase.end_date ?? "",
  });

  async function commit(
    patch: Partial<typeof draft>,
    fieldKey?: keyof typeof draft,
  ): Promise<void> {
    if (fieldKey) {
      const next = draft[fieldKey];
      const current = (phase[fieldKey] ?? "") as string | number | null;
      if (next === current) return;
    }
    const payload: Parameters<typeof updatePhaseAction>[1] = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v === "" && (k === "objective" || k === "rationale")) {
        (payload as Record<string, unknown>)[k] = null;
      } else if (k === "start_date" || k === "end_date") {
        (payload as Record<string, unknown>)[k] = v === "" ? null : v;
      } else {
        (payload as Record<string, unknown>)[k] = v;
      }
    }
    try {
      const updated = await updatePhaseAction(phase.id, payload);
      onPatched(updated);
    } catch (err) {
      console.error("[phase-form] commit failed", err);
    }
  }

  function handleStatusChange(value: Key | null): void {
    if (value === null) return;
    const next = String(value) as PhaseStatus;
    setDraft((d) => ({ ...d, status: next }));
    if (next !== phase.status) {
      void commit({ status: next });
    }
  }

  function handleProgressBlur(): void {
    const raw = draft.progress_percent;
    if (raw === phase.progress_percent) return;
    if (raw !== null && (raw < 0 || raw > 100)) return;
    void commit({ progress_percent: raw });
  }

  function handleDateBlur(field: "start_date" | "end_date"): void {
    const value = draft[field];
    const current = phase[field] ?? "";
    if (value === current) return;
    // start <= end check
    const start = field === "start_date" ? value : draft.start_date;
    const end = field === "end_date" ? value : draft.end_date;
    if (start && end && start > end) return;
    void commit({ [field]: value });
  }

  const nameInvalid = draft.name.trim().length === 0;
  const dateOrderInvalid =
    draft.start_date !== "" &&
    draft.end_date !== "" &&
    draft.start_date > draft.end_date;
  const progressInvalid =
    draft.progress_percent !== null &&
    draft.progress_percent !== undefined &&
    (draft.progress_percent < 0 || draft.progress_percent > 100);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => e.preventDefault()}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Fase
      </h2>

      <TextField>
        <Label>Nombre</Label>
        <Input
          value={draft.name}
          onChange={(e) =>
            setDraft({ ...draft, name: e.currentTarget.value })
          }
          onBlur={() => commit({ name: draft.name }, "name")}
          maxLength={NAME_MAX}
          autoFocus
        />
        {nameInvalid ? (
          <p className="mt-1 text-xs text-danger">El nombre es obligatorio.</p>
        ) : null}
      </TextField>

      <Textarea
        label="Objetivo"
        helper="El qué — qué se busca lograr en esta fase."
        value={draft.objective}
        onChange={(v) => setDraft({ ...draft, objective: v })}
        onBlur={() => commit({ objective: draft.objective }, "objective")}
        rows={3}
      />

      <Textarea
        label="Rationale"
        helper="El por qué — clave para narrativas ejecutivas."
        value={draft.rationale}
        onChange={(v) => setDraft({ ...draft, rationale: v })}
        onBlur={() => commit({ rationale: draft.rationale }, "rationale")}
        rows={3}
      />

      <Select
        className="w-[260px]"
        value={draft.status}
        onChange={handleStatusChange}
      >
        <Label>Estado</Label>
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
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Inicio</span>
          <input
            type="date"
            value={draft.start_date}
            onChange={(e) =>
              setDraft({ ...draft, start_date: e.currentTarget.value })
            }
            onBlur={() => handleDateBlur("start_date")}
            className={dateInputClasses}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Fin</span>
          <input
            type="date"
            value={draft.end_date}
            onChange={(e) =>
              setDraft({ ...draft, end_date: e.currentTarget.value })
            }
            onBlur={() => handleDateBlur("end_date")}
            className={dateInputClasses}
          />
        </label>
        {dateOrderInvalid ? (
          <p className="col-span-full text-xs text-danger">
            La fecha de inicio debe ser igual o anterior a la fecha de fin.
          </p>
        ) : null}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Progreso (%)</span>
        <input
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
          onBlur={handleProgressBlur}
          className={`${dateInputClasses} max-w-[120px]`}
        />
        <span className="text-xs text-muted">
          Si lo dejás vacío, se calcula automáticamente desde los issues
          asociados a sus workstreams.
        </span>
        {progressInvalid ? (
          <p className="text-xs text-danger">
            El progreso debe estar entre 0 y 100.
          </p>
        ) : null}
      </label>

      <div className="border-t border-default-200 pt-4">
        <Button
          variant="tertiary"
          size="sm"
          onPress={onDelete}
          isDisabled={pendingDelete}
          className="text-danger"
        >
          {pendingDelete ? "Eliminando…" : "Eliminar fase"}
        </Button>
      </div>
    </form>
  );
}

const dateInputClasses =
  "rounded-md border border-default-300 bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400";

function Textarea({
  label,
  helper,
  value,
  onChange,
  onBlur,
  rows,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  rows: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={onBlur}
        rows={rows}
        className="w-full rounded-md border border-default-300 bg-surface px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400"
      />
      {helper ? (
        <span className="text-xs text-muted">{helper}</span>
      ) : null}
    </label>
  );
}
