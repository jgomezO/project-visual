"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Input, Label, TextField } from "@heroui/react";
import { updateNarrativeAction } from "@/app/actions/narratives";
import { relativeFromNow } from "@/lib/format/relativeTime";
import type { ProjectNarrative } from "@/lib/narratives/types";
import { useAutoSave, type SaveState } from "./useAutoSave";

const TITLE_MAX = 200;
const SUBTITLE_MAX = 200;

export interface FormHandle {
  flush: () => Promise<{ ok: boolean }>;
  retry: () => void;
}

interface NarrativeFormProps {
  narrative: ProjectNarrative;
  onPatched: (next: ProjectNarrative) => void;
  onSaveStateChange?: (state: SaveState) => void;
}

export const NarrativeForm = forwardRef<FormHandle, NarrativeFormProps>(
  function NarrativeForm({ narrative, onPatched, onSaveStateChange }, ref) {
    const [draft, setDraft] = useState({
      title: narrative.title,
      subtitle: narrative.subtitle ?? "",
      overview: narrative.overview ?? "",
      status_summary: narrative.status_summary ?? "",
      risks_section_subtitle: narrative.risks_section_subtitle ?? "",
    });

    const titleInvalid = draft.title.trim().length === 0;
    const titleTooLong = draft.title.length > TITLE_MAX;
    const subtitleTooLong = draft.subtitle.length > SUBTITLE_MAX;
    const isInvalid = titleInvalid || titleTooLong || subtitleTooLong;

    const { state, errorMessage, lastSavedAt, flush, retry } = useAutoSave(
      draft,
      async (snapshot) => {
        if (isInvalid) {
          throw new Error("El título es obligatorio y no puede ser tan largo.");
        }
        const updated = await updateNarrativeAction(narrative.id, {
          title: snapshot.title,
          subtitle: snapshot.subtitle.trim() || null,
          overview: snapshot.overview || null,
          status_summary: snapshot.status_summary || null,
          risks_section_subtitle:
            snapshot.risks_section_subtitle.trim() || null,
          updated_by: "system",
        });
        onPatched(updated);
      },
      { onStateChange: onSaveStateChange },
    );

    useImperativeHandle(ref, () => ({ flush, retry }), [flush, retry]);

    // Surface flush state to the parent via the `state` returned. Kept here
    // (commented) for completeness — `onSaveStateChange` already publishes it.
    void state;
    void errorMessage;
    void lastSavedAt;

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
            maxLength={TITLE_MAX}
          />
          {titleInvalid ? (
            <p className="mt-1 text-xs text-danger">
              El título es obligatorio.
            </p>
          ) : null}
        </TextField>

        <TextField>
          <Label>Subtítulo</Label>
          <Input
            value={draft.subtitle}
            onChange={(e) =>
              setDraft({ ...draft, subtitle: e.currentTarget.value })
            }
            maxLength={SUBTITLE_MAX}
            placeholder="Audiencia / contexto / fecha"
          />
        </TextField>

        <LabeledTextarea
          label="Overview"
          helper="Contexto general del proyecto. Markdown plain (sin renderizado por ahora)."
          value={draft.overview}
          onChange={(v) => setDraft({ ...draft, overview: v })}
          rows={6}
        />

        <LabeledTextarea
          label="Estado actual"
          helper="Resumen del momento actual del proyecto. Aparece en la vista pública."
          value={draft.status_summary}
          onChange={(v) => setDraft({ ...draft, status_summary: v })}
          rows={4}
        />

        <TextField>
          <Label>Subtítulo de la sección de riesgos</Label>
          <Input
            value={draft.risks_section_subtitle}
            onChange={(e) =>
              setDraft({
                ...draft,
                risks_section_subtitle: e.currentTarget.value,
              })
            }
            placeholder="Opcional: aparece bajo el título “Riesgos del proyecto”"
          />
        </TextField>

        <div className="grid grid-cols-2 gap-4 border-t border-default-200 pt-4 text-xs text-muted">
          <ReadOnlyField
            label="Creado por"
            value={narrative.created_by ?? "—"}
          />
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
  },
);

function LabeledTextarea({
  label,
  helper,
  value,
  onChange,
  rows,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        rows={rows}
        className="w-full rounded-md border border-default-300 bg-surface px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400"
      />
      {helper ? <span className="text-xs text-muted">{helper}</span> : null}
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
