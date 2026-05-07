"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Label, ListBox, Select } from "@heroui/react";
import type { Key } from "@heroui/react";
import { useTranslations } from "next-intl";
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

const STATUS_KEYS: PhaseStatus[] = [
  "upcoming",
  "in_progress",
  "completed",
  "at_risk",
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
    const t = useTranslations("narratives.editor.phase");
    const tStatus = useTranslations("common.phaseStatus");
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
          throw new Error(t("saveError"));
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
        <SectionHeading>{t("section")}</SectionHeading>

        <Field
          label={t("fields.name.label")}
          error={nameInvalid ? t("fields.name.required") : undefined}
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
          label={t("fields.objective.label")}
          helper={t("fields.objective.helper")}
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
          label={t("fields.rationale.label")}
          helper={t("fields.rationale.helper")}
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
            {t("fields.status.label")}
          </Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {STATUS_KEYS.map((key) => {
                const label = tStatus(key);
                return (
                  <ListBox.Item key={key} id={key} textValue={label}>
                    {label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                );
              })}
            </ListBox>
          </Select.Popover>
        </Select>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateInputField
            label={t("fields.startDate.label")}
            value={draft.start_date}
            onChange={(v) => setDraft({ ...draft, start_date: v })}
          />
          <DateInputField
            label={t("fields.endDate.label")}
            value={draft.end_date}
            onChange={(v) => setDraft({ ...draft, end_date: v })}
            error={
              dateOrderInvalid ? t("fields.endDate.orderInvalid") : undefined
            }
          />
        </div>

        <Field
          label={t("fields.progress.label")}
          helper={t("fields.progress.helper")}
          error={progressInvalid ? t("fields.progress.invalid") : undefined}
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
          {pendingDelete ? t("delete.pending") : t("delete.idle")}
        </FormDeleteButton>
      </form>
    );
  },
);
