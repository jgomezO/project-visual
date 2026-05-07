"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Label, ListBox, Select } from "@heroui/react";
import type { Key } from "@heroui/react";
import { useTranslations } from "next-intl";
import { updateWorkstreamAction } from "@/app/actions/narratives";
import type {
  NarrativePhaseWithWorkstreams,
  NarrativeWorkstream,
} from "@/lib/narratives/types";
import {
  Field,
  FormDeleteButton,
  SectionHeading,
  TextInput,
  Textarea,
} from "./form-fields";
import { JiraIssueKeysInput } from "./JiraIssueKeysInput";
import type { FormHandle } from "./NarrativeForm";
import { useAutoSave, type SaveState } from "./useAutoSave";

const NAME_MAX = 200;
const ORPHAN_KEY = "__orphan__";

interface WorkstreamFormProps {
  workstream: NarrativeWorkstream;
  phases: NarrativePhaseWithWorkstreams[];
  projectId: string;
  onPatched: (next: NarrativeWorkstream) => void;
  onDelete: () => void;
  pendingDelete: boolean;
  onSaveStateChange?: (state: SaveState) => void;
}

export const WorkstreamForm = forwardRef<FormHandle, WorkstreamFormProps>(
  function WorkstreamForm(
    {
      workstream,
      phases,
      projectId,
      onPatched,
      onDelete,
      pendingDelete,
      onSaveStateChange,
    },
    ref,
  ) {
    const t = useTranslations("narratives.editor.workstream");
    const [draft, setDraft] = useState({
      name: workstream.name,
      description: workstream.description ?? "",
      phase_id: workstream.phase_id,
      jira_issue_keys: workstream.jira_issue_keys,
    });

    const nameInvalid = draft.name.trim().length === 0;

    const { flush, retry } = useAutoSave(
      draft,
      async (snapshot) => {
        if (nameInvalid) {
          throw new Error(t("fields.name.required"));
        }
        const updated = await updateWorkstreamAction(workstream.id, {
          name: snapshot.name,
          description: snapshot.description || null,
          phase_id: snapshot.phase_id,
          jira_issue_keys: snapshot.jira_issue_keys,
        });
        onPatched(updated);
      },
      { onStateChange: onSaveStateChange },
    );

    useImperativeHandle(ref, () => ({ flush, retry }), [flush, retry]);

    function handlePhaseChange(value: Key | null): void {
      if (value === null) return;
      const next = String(value) === ORPHAN_KEY ? null : String(value);
      if (next === draft.phase_id) return;
      setDraft((d) => ({ ...d, phase_id: next }));
    }

    const phaseSelectValue = draft.phase_id ?? ORPHAN_KEY;
    const orphanLabel = t("fields.phase.orphan");

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
          label={t("fields.description.label")}
          helper={t("fields.description.helper")}
        >
          <Textarea
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.currentTarget.value })
            }
            rows={4}
          />
        </Field>

        <Select
          className="w-[260px]"
          value={phaseSelectValue}
          onChange={handlePhaseChange}
        >
          <Label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            {t("fields.phase.label")}
          </Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {phases.map((p) => (
                <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                  {p.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
              <ListBox.Item id={ORPHAN_KEY} textValue={orphanLabel}>
                {orphanLabel}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>

        <JiraIssueKeysInput
          projectId={projectId}
          value={draft.jira_issue_keys}
          onChange={(next) =>
            setDraft((d) => ({ ...d, jira_issue_keys: next }))
          }
        />

        <FormDeleteButton onClick={onDelete} disabled={pendingDelete}>
          {pendingDelete ? t("delete.pending") : t("delete.idle")}
        </FormDeleteButton>
      </form>
    );
  },
);
