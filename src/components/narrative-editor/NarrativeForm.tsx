"use client";

import { useState } from "react";
import { Input, Label, TextField } from "@heroui/react";
import { updateNarrativeAction } from "@/app/actions/narratives";
import { relativeFromNow } from "@/lib/format/relativeTime";
import type { ProjectNarrative } from "@/lib/narratives/types";

const TITLE_MAX = 200;
const SUBTITLE_MAX = 200;

export function NarrativeForm({
  narrative,
  onPatched,
}: {
  narrative: ProjectNarrative;
  onPatched: (next: ProjectNarrative) => void;
}) {
  // Local draft. Keyed by narrative id at the parent so a different
  // narrative remounts this component cleanly.
  const [draft, setDraft] = useState({
    title: narrative.title,
    subtitle: narrative.subtitle ?? "",
    overview: narrative.overview ?? "",
    status_summary: narrative.status_summary ?? "",
  });

  async function commit(field: keyof typeof draft): Promise<void> {
    const next = draft[field];
    const current = (narrative[field] ?? "") as string;
    if (next === current) return;
    if (field === "title" && next.trim().length === 0) return;
    if (field === "title" && next.length > TITLE_MAX) return;
    if (field === "subtitle" && next.length > SUBTITLE_MAX) return;
    try {
      const updated = await updateNarrativeAction(narrative.id, {
        [field]: field === "subtitle" ? (next || null) : next,
      });
      onPatched(updated);
    } catch (err) {
      // Silent in commit 3; the autosave indicator in commit 4 will
      // surface this. The user's draft remains in local state.
      console.error("[narrative-form] commit failed", err);
    }
  }

  const titleInvalid = draft.title.trim().length === 0;

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => e.preventDefault()}
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
        Narrativa
      </h2>

      <TextField>
        <Label>Título</Label>
        <Input
          value={draft.title}
          onChange={(e) =>
            setDraft({ ...draft, title: e.currentTarget.value })
          }
          onBlur={() => commit("title")}
          maxLength={TITLE_MAX}
        />
        {titleInvalid ? (
          <p className="mt-1 text-xs text-danger">El título es obligatorio.</p>
        ) : null}
      </TextField>

      <TextField>
        <Label>Subtítulo</Label>
        <Input
          value={draft.subtitle}
          onChange={(e) =>
            setDraft({ ...draft, subtitle: e.currentTarget.value })
          }
          onBlur={() => commit("subtitle")}
          maxLength={SUBTITLE_MAX}
          placeholder="Audiencia / contexto / fecha"
        />
      </TextField>

      <LabeledTextarea
        label="Overview"
        helper="Contexto general del proyecto. Markdown plain (sin renderizado por ahora)."
        value={draft.overview}
        onChange={(v) => setDraft({ ...draft, overview: v })}
        onBlur={() => commit("overview")}
        rows={6}
      />

      <LabeledTextarea
        label="Estado actual"
        helper="Resumen del momento actual del proyecto. Aparece en la vista pública."
        value={draft.status_summary}
        onChange={(v) => setDraft({ ...draft, status_summary: v })}
        onBlur={() => commit("status_summary")}
        rows={4}
      />

      <div className="grid grid-cols-2 gap-4 border-t border-default-200 pt-4 text-xs text-muted">
        <ReadOnlyField label="Creado por" value={narrative.created_by ?? "—"} />
        <ReadOnlyField
          label="Actualizado por"
          value={narrative.updated_by ?? "—"}
        />
        <ReadOnlyField
          label="Creado"
          value={relativeFromNow(narrative.created_at)}
        />
        <ReadOnlyField
          label="Actualizado"
          value={relativeFromNow(narrative.updated_at)}
        />
      </div>
    </form>
  );
}

function LabeledTextarea({
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

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
