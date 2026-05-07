"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Label, ListBox, Select } from "@heroui/react";
import type { Key } from "@heroui/react";
import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { updateWorkstreamAction } from "@/app/actions/narratives";
import type { Locale } from "@/i18n/routing";
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
import { AIRefineModal } from "./AIRefineModal";
import { JiraIssueKeysInput } from "./JiraIssueKeysInput";
import type { FormHandle } from "./NarrativeForm";
import { useAutoSave, type SaveState } from "./useAutoSave";
import { useWorkstreamDescriptionAI } from "./useWorkstreamDescriptionAI";

const NAME_MAX = 200;
const ORPHAN_KEY = "__orphan__";

// Three states for the AI button next to the description label:
//   - 'disabled': workstream has no linked Jira issues. Button shown
//     with grayed styling + tooltip explaining why ("Link issues to
//     use AI assistance"). Click is a no-op.
//   - 'generate': workstream has issues + description is empty. Click
//     streams generated text directly into the description field.
//   - 'refine': workstream has issues + description is non-empty. Click
//     opens the AIRefineModal (commit 6).
type AIButtonState = "disabled" | "generate" | "refine";

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
    const tAi = useTranslations("narratives.ai");
    const locale = useLocale() as Locale;
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

    // ---------- AI assist (iter 7) ----------
    const ai = useWorkstreamDescriptionAI();
    const isStreaming = ai.state === "streaming";
    const [refineModalOpen, setRefineModalOpen] = useState(false);
    // Snapshot the operation at click time so the button label doesn't
    // flip mid-stream. Without this, "Generating…" would become
    // "Refining…" the moment the first chunk lands and `description`
    // stops being empty (which would re-derive buttonState to 'refine').
    const [operationInFlight, setOperationInFlight] = useState<
      "generate" | "refine" | null
    >(null);

    const hasIssues = draft.jira_issue_keys.length > 0;
    const isDescriptionEmpty =
      !draft.description || draft.description.trim().length === 0;
    const buttonState: AIButtonState = !hasIssues
      ? "disabled"
      : isDescriptionEmpty
        ? "generate"
        : "refine";

    function handleAIClick(): void {
      if (buttonState === "disabled" || isStreaming) return;
      if (buttonState === "refine") {
        // Refine flow opens AIRefineModal — streaming feeds the modal's
        // right column, not the form's description field. The user
        // accepts or discards via the modal footer; on accept we
        // overwrite draft.description and the auto-save hook persists.
        setRefineModalOpen(true);
        return;
      }
      // Generate flow: clear the field, stream chunks straight into draft.
      setOperationInFlight("generate");
      setDraft((d) => ({ ...d, description: "" }));
      void ai.start({
        workstreamId: workstream.id,
        narrativeId: workstream.narrative_id,
        issueKeys: draft.jira_issue_keys,
        currentText: undefined,
        locale,
        onChunk: (delta) => {
          setDraft((d) => ({ ...d, description: d.description + delta }));
        },
        onComplete: () => setOperationInFlight(null),
        onError: () => setOperationInFlight(null),
      });
    }

    function aiButtonLabel(): string {
      if (isStreaming && operationInFlight) {
        return operationInFlight === "refine"
          ? tAi("refining")
          : tAi("generating");
      }
      if (buttonState === "refine") return tAi("refineButton");
      // 'disabled' and 'generate' both show the "Generate with AI"
      // label — disabled adds a tooltip explaining why.
      return tAi("generateButton");
    }

    return (
      <>
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

        {/* Description block with the AI assist button next to its label.
            We can't reuse Field here because Field wraps in a single
            <label> with no slot for header-row actions — the button
            needs to sit on the same row as the label, justify-between. */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              {t("fields.description.label")}
            </span>
            <button
              type="button"
              onClick={handleAIClick}
              disabled={buttonState === "disabled" || isStreaming}
              title={
                buttonState === "disabled"
                  ? tAi("disabledTooltip")
                  : undefined
              }
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-50 disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent"
            >
              <Sparkles
                className={`size-3.5 ${isStreaming ? "animate-pulse motion-reduce:animate-none" : ""}`}
                aria-hidden="true"
              />
              {aiButtonLabel()}
            </button>
          </div>
          <Textarea
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.currentTarget.value })
            }
            rows={4}
            // Lock edits while streaming to avoid the user typing in the
            // middle of an AI write. Re-enabled the moment streaming
            // ends (success / error / cancelled).
            disabled={isStreaming}
          />
          {ai.errorMessage ? (
            <span className="text-sm text-error" role="alert">
              {ai.errorMessage}
            </span>
          ) : (
            <span className="text-sm text-text-secondary">
              {t("fields.description.helper")}
            </span>
          )}
        </div>

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

      <AIRefineModal
        isOpen={refineModalOpen}
        onOpenChange={setRefineModalOpen}
        workstreamId={workstream.id}
        narrativeId={workstream.narrative_id}
        issueKeys={draft.jira_issue_keys}
        originalText={draft.description}
        onAccept={(refined) => {
          // Overwrite the draft; auto-save picks it up on the next tick.
          setDraft((d) => ({ ...d, description: refined }));
        }}
      />
      </>
    );
  },
);
