"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Label, ListBox, Select } from "@heroui/react";
import type { Key } from "@heroui/react";
import { useTranslations } from "next-intl";
import { updateDependencyAction } from "@/app/actions/narratives";
import type {
  CommitmentStatus,
  NarrativeDependency,
  NarrativePhaseWithWorkstreams,
  NarrativeWorkstream,
} from "@/lib/narratives/types";
import {
  DateInputField,
  Field,
  FormDeleteButton,
  SectionHeading,
  TextInput,
  Textarea,
} from "./form-fields";
import { JiraIssueKeysInput } from "./JiraIssueKeysInput";
import type { FormHandle } from "./NarrativeForm";
import { PodAutocompleteInput } from "./PodAutocompleteInput";
import { useAutoSave, type SaveState } from "./useAutoSave";

const TITLE_MAX = 200;
const NARRATIVE_KEY = "__narrative__";

const STATUS_KEYS: CommitmentStatus[] = [
  "proposed",
  "agreed",
  "confirmed",
  "at_risk",
  "blocked",
];

interface DependencyFormProps {
  dependency: NarrativeDependency;
  phases: NarrativePhaseWithWorkstreams[];
  orphanWorkstreams: NarrativeWorkstream[];
  projectId: string;
  onPatched: (next: NarrativeDependency) => void;
  onDelete: () => void;
  pendingDelete: boolean;
  onSaveStateChange?: (state: SaveState) => void;
}

export const DependencyForm = forwardRef<FormHandle, DependencyFormProps>(
  function DependencyForm(
    {
      dependency,
      phases,
      orphanWorkstreams,
      projectId,
      onPatched,
      onDelete,
      pendingDelete,
      onSaveStateChange,
    },
    ref,
  ) {
    const t = useTranslations("narratives.editor.dependency");
    const tCommitment = useTranslations("common.commitmentStatus");
    const [draft, setDraft] = useState({
      title: dependency.title,
      description: dependency.description ?? "",
      workstream_id: dependency.workstream_id,
      provider_pod: dependency.provider_pod,
      provider_pod_project_key: dependency.provider_pod_project_key,
      provider_jira_issue_keys: dependency.provider_jira_issue_keys,
      needed_by_date: dependency.needed_by_date ?? "",
      expected_delivery_date: dependency.expected_delivery_date ?? "",
      commitment_status: dependency.commitment_status as CommitmentStatus,
      coordination_notes: dependency.coordination_notes ?? "",
    });

    const titleInvalid = draft.title.trim().length === 0;

    const { flush, retry } = useAutoSave(
      draft,
      async (snapshot) => {
        if (titleInvalid) {
          throw new Error(t("fields.title.required"));
        }
        const updated = await updateDependencyAction(dependency.id, {
          title: snapshot.title,
          description: snapshot.description || null,
          workstream_id: snapshot.workstream_id,
          provider_pod: snapshot.provider_pod,
          provider_pod_project_key: snapshot.provider_pod_project_key,
          provider_jira_issue_keys: snapshot.provider_jira_issue_keys,
          needed_by_date: snapshot.needed_by_date || null,
          expected_delivery_date: snapshot.expected_delivery_date || null,
          commitment_status: snapshot.commitment_status,
          coordination_notes: snapshot.coordination_notes || null,
        });
        onPatched(updated);
      },
      { onStateChange: onSaveStateChange },
    );

    useImperativeHandle(ref, () => ({ flush, retry }), [flush, retry]);

    function handleWorkstreamChange(value: Key | null): void {
      if (value === null) return;
      const next = String(value) === NARRATIVE_KEY ? null : String(value);
      if (next === draft.workstream_id) return;
      setDraft((d) => ({ ...d, workstream_id: next }));
    }

    function handleStatusChange(value: Key | null): void {
      if (value === null) return;
      setDraft((d) => ({
        ...d,
        commitment_status: String(value) as CommitmentStatus,
      }));
    }

    const workstreamSelectValue = draft.workstream_id ?? NARRATIVE_KEY;
    const allWorkstreams: NarrativeWorkstream[] = [
      ...phases.flatMap((p) => p.workstreams),
      ...orphanWorkstreams,
    ];
    const narrativeOption = t("fields.workstream.narrativeOption");

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
            autoFocus
          />
        </Field>

        <Field label={t("fields.description.label")}>
          <Textarea
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.currentTarget.value })
            }
            rows={3}
            placeholder={t("fields.description.placeholder")}
          />
        </Field>

        <Select
          className="w-[320px]"
          value={workstreamSelectValue}
          onChange={handleWorkstreamChange}
        >
          <Label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            {t("fields.workstream.label")}
          </Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={NARRATIVE_KEY} textValue={narrativeOption}>
                {narrativeOption}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {allWorkstreams.map((w) => (
                <ListBox.Item key={w.id} id={w.id} textValue={w.name}>
                  {w.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <PodAutocompleteInput
          pod={draft.provider_pod}
          podKey={draft.provider_pod_project_key}
          onChange={(next) =>
            setDraft((d) => ({
              ...d,
              provider_pod: next.pod,
              provider_pod_project_key: next.podKey,
              // Picking / unlinking a project changes the autocomplete
              // scope below; the keys already chosen stay (we don't
              // want to silently drop user data on a scope flip), but
              // they may render as warning chips if the new scope
              // can't resolve them.
            }))
          }
        />

        <JiraIssueKeysInput
          projectId={projectId}
          providerProjectKey={draft.provider_pod_project_key}
          value={draft.provider_jira_issue_keys}
          onChange={(next) =>
            setDraft((d) => ({ ...d, provider_jira_issue_keys: next }))
          }
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DateInputField
            label={t("fields.neededBy.label")}
            value={draft.needed_by_date}
            onChange={(v) => setDraft({ ...draft, needed_by_date: v })}
          />
          <DateInputField
            label={t("fields.expectedDelivery.label")}
            value={draft.expected_delivery_date}
            onChange={(v) =>
              setDraft({ ...draft, expected_delivery_date: v })
            }
            helper={t("fields.expectedDelivery.helper")}
          />
        </div>

        <Select
          className="w-[260px]"
          value={draft.commitment_status}
          onChange={handleStatusChange}
        >
          <Label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            {t("fields.commitmentStatus.label")}
          </Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {STATUS_KEYS.map((key) => {
                const label = tCommitment(key);
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

        <Field label={t("fields.coordinationNotes.label")}>
          <Textarea
            value={draft.coordination_notes}
            onChange={(e) =>
              setDraft({
                ...draft,
                coordination_notes: e.currentTarget.value,
              })
            }
            rows={5}
            placeholder={t("fields.coordinationNotes.placeholder")}
          />
        </Field>

        <FormDeleteButton onClick={onDelete} disabled={pendingDelete}>
          {pendingDelete ? t("delete.pending") : t("delete.idle")}
        </FormDeleteButton>
      </form>
    );
  },
);
