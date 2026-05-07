"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { updateNarrativeAction } from "@/app/actions/narratives";
import { formatActor } from "@/lib/format/actor";
import type { ProjectNarrative } from "@/lib/narratives/types";
import { Field, SectionHeading, TextInput, Textarea } from "./form-fields";
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
    const t = useTranslations("narratives.editor.narrative");
    const tActor = useTranslations("common.actor");
    const format = useFormatter();
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
          throw new Error(t("saveError"));
        }
        const updated = await updateNarrativeAction(narrative.id, {
          title: snapshot.title,
          subtitle: snapshot.subtitle.trim() || null,
          overview: snapshot.overview || null,
          status_summary: snapshot.status_summary || null,
          risks_section_subtitle:
            snapshot.risks_section_subtitle.trim() || null,
        });
        onPatched(updated);
      },
      { onStateChange: onSaveStateChange },
    );

    useImperativeHandle(ref, () => ({ flush, retry }), [flush, retry]);

    void state;
    void errorMessage;
    void lastSavedAt;

    const actorTranslator = (key: "system") => tActor(key);

    return (
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <SectionHeading>{t("section")}</SectionHeading>

        <Field
          label={t("fields.title.label")}
          error={titleInvalid ? t("fields.title.required") : undefined}
        >
          <TextInput
            value={draft.title}
            onChange={(e) =>
              setDraft({ ...draft, title: e.currentTarget.value })
            }
            maxLength={TITLE_MAX}
          />
        </Field>

        <Field label={t("fields.subtitle.label")}>
          <TextInput
            value={draft.subtitle}
            onChange={(e) =>
              setDraft({ ...draft, subtitle: e.currentTarget.value })
            }
            maxLength={SUBTITLE_MAX}
            placeholder={t("fields.subtitle.placeholder")}
          />
        </Field>

        <Field
          label={t("fields.overview.label")}
          helper={t("fields.overview.helper")}
        >
          <Textarea
            value={draft.overview}
            onChange={(e) =>
              setDraft({ ...draft, overview: e.currentTarget.value })
            }
            rows={6}
          />
        </Field>

        <Field
          label={t("fields.statusSummary.label")}
          helper={t("fields.statusSummary.helper")}
        >
          <Textarea
            value={draft.status_summary}
            onChange={(e) =>
              setDraft({ ...draft, status_summary: e.currentTarget.value })
            }
            rows={4}
          />
        </Field>

        <Field label={t("fields.risksSubtitle.label")}>
          <TextInput
            value={draft.risks_section_subtitle}
            onChange={(e) =>
              setDraft({
                ...draft,
                risks_section_subtitle: e.currentTarget.value,
              })
            }
            placeholder={t("fields.risksSubtitle.placeholder")}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
          <ReadOnlyField
            label={t("meta.createdBy")}
            value={formatActor(narrative.created_by, actorTranslator)}
          />
          <ReadOnlyField
            label={t("meta.updatedBy")}
            value={formatActor(narrative.updated_by, actorTranslator)}
          />
          <ReadOnlyField
            label={t("meta.created")}
            value={format.relativeTime(new Date(narrative.created_at))}
          />
          <ReadOnlyField
            label={t("meta.updated")}
            value={format.relativeTime(new Date(narrative.updated_at))}
          />
        </div>
      </form>
    );
  },
);

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <p className="text-sm text-text-primary">{value}</p>
    </div>
  );
}
