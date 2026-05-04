"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Button,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import { updateDependencyAction } from "@/app/actions/narratives";
import type {
  CommitmentStatus,
  NarrativeDependency,
  NarrativePhaseWithWorkstreams,
  NarrativeWorkstream,
} from "@/lib/narratives/types";
import { JiraIssueKeysInput } from "./JiraIssueKeysInput";
import type { FormHandle } from "./NarrativeForm";
import { PodAutocompleteInput } from "./PodAutocompleteInput";
import { useAutoSave, type SaveState } from "./useAutoSave";

const TITLE_MAX = 200;
const NARRATIVE_KEY = "__narrative__";

const STATUS_OPTIONS: { id: CommitmentStatus; label: string }[] = [
  { id: "proposed", label: "Propuesto" },
  { id: "agreed", label: "Acordado" },
  { id: "confirmed", label: "Confirmado" },
  { id: "at_risk", label: "En riesgo" },
  { id: "blocked", label: "Bloqueado" },
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
          throw new Error("El título es obligatorio.");
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

    return (
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Dependencia
        </h2>

        <TextField>
          <Label>Título</Label>
          <Input
            value={draft.title}
            onChange={(e) =>
              setDraft({ ...draft, title: e.currentTarget.value })
            }
            maxLength={TITLE_MAX}
            autoFocus
          />
          {titleInvalid ? (
            <p className="mt-1 text-xs text-danger">
              El título es obligatorio.
            </p>
          ) : null}
        </TextField>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Descripción</span>
          <textarea
            value={draft.description}
            onChange={(e) =>
              setDraft({ ...draft, description: e.currentTarget.value })
            }
            rows={3}
            placeholder="¿Qué se necesita del provider?"
            className="w-full rounded-md border border-default-300 bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400"
          />
        </label>

        <Select
          className="w-[320px]"
          value={workstreamSelectValue}
          onChange={handleWorkstreamChange}
        >
          <Label>Workstream impactado</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={NARRATIVE_KEY} textValue="Toda la narrativa">
                Toda la narrativa
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
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Cuándo lo necesitamos</span>
            <input
              type="date"
              value={draft.needed_by_date}
              onChange={(e) =>
                setDraft({ ...draft, needed_by_date: e.currentTarget.value })
              }
              className="rounded-md border border-default-300 bg-surface px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Cuándo se entregaría</span>
            <input
              type="date"
              value={draft.expected_delivery_date}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  expected_delivery_date: e.currentTarget.value,
                })
              }
              className="rounded-md border border-default-300 bg-surface px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400"
            />
            <span className="text-xs text-muted">
              Si lo dejás vacío y vinculaste issues, se calcula automáticamente
              desde la fecha de entrega más tardía de esos issues.
            </span>
          </label>
        </div>

        <Select
          className="w-[260px]"
          value={draft.commitment_status}
          onChange={handleStatusChange}
        >
          <Label>Estado del compromiso</Label>
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

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Esfuerzo de coordinación</span>
          <textarea
            value={draft.coordination_notes}
            onChange={(e) =>
              setDraft({
                ...draft,
                coordination_notes: e.currentTarget.value,
              })
            }
            rows={5}
            placeholder="¿Qué hay que sincronizar entre equipos? Reuniones, dependencias técnicas, escalations…"
            className="w-full rounded-md border border-default-300 bg-surface px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400"
          />
        </label>

        <div className="border-t border-default-200 pt-4">
          <Button
            variant="tertiary"
            size="sm"
            onPress={onDelete}
            isDisabled={pendingDelete}
            className="text-danger"
          >
            {pendingDelete ? "Eliminando…" : "Eliminar dependencia"}
          </Button>
        </div>
      </form>
    );
  },
);
