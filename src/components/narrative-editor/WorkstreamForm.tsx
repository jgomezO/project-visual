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
import { updateWorkstreamAction } from "@/app/actions/narratives";
import type {
  NarrativePhaseWithWorkstreams,
  NarrativeWorkstream,
} from "@/lib/narratives/types";
import type { FormHandle } from "./NarrativeForm";
import { useAutoSave, type SaveState } from "./useAutoSave";

const NAME_MAX = 200;
const ORPHAN_KEY = "__orphan__";

interface WorkstreamFormProps {
  workstream: NarrativeWorkstream;
  phases: NarrativePhaseWithWorkstreams[];
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
      onPatched,
      onDelete,
      pendingDelete,
      onSaveStateChange,
    },
    ref,
  ) {
    const [draft, setDraft] = useState({
      name: workstream.name,
      description: workstream.description ?? "",
      phase_id: workstream.phase_id,
    });

    const nameInvalid = draft.name.trim().length === 0;

    const { flush, retry } = useAutoSave(
      draft,
      async (snapshot) => {
        if (nameInvalid) {
          throw new Error("El nombre es obligatorio.");
        }
        const updated = await updateWorkstreamAction(workstream.id, {
          name: snapshot.name,
          description: snapshot.description || null,
          phase_id: snapshot.phase_id,
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

    return (
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => e.preventDefault()}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Workstream
        </h2>

        <TextField>
          <Label>Nombre</Label>
          <Input
            value={draft.name}
            onChange={(e) =>
              setDraft({ ...draft, name: e.currentTarget.value })
            }
            maxLength={NAME_MAX}
            autoFocus
          />
          {nameInvalid ? (
            <p className="mt-1 text-xs text-danger">
              El nombre es obligatorio.
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
            rows={4}
            className="w-full rounded-md border border-default-300 bg-surface px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400"
          />
          <span className="text-xs text-muted">
            Markdown plain (sin renderizado por ahora).
          </span>
        </label>

        <Select
          className="w-[260px]"
          value={phaseSelectValue}
          onChange={handlePhaseChange}
        >
          <Label>Fase</Label>
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
              <ListBox.Item id={ORPHAN_KEY} textValue="Sin fase">
                Sin fase
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Issues de Jira</span>
          <div className="rounded-md border border-dashed border-default-300 p-3 text-xs text-muted">
            {workstream.jira_issue_keys.length === 0 ? (
              <span>Sin issues vinculadas. Editor llega en commit 5.</span>
            ) : (
              <span>
                {workstream.jira_issue_keys.length} issue(s) vinculada(s):{" "}
                {workstream.jira_issue_keys.join(", ")}
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-default-200 pt-4">
          <Button
            variant="tertiary"
            size="sm"
            onPress={onDelete}
            isDisabled={pendingDelete}
            className="text-danger"
          >
            {pendingDelete ? "Eliminando…" : "Eliminar workstream"}
          </Button>
        </div>
      </form>
    );
  },
);
