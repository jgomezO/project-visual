"use client";

import { Layers, Plus } from "lucide-react";
import { Button, Card } from "@/components/ui";

// Editor-specific empty state. Renders below NarrativeForm (NOT in
// place of it) when the narrative root is selected and the tree has
// no phases and no orphan workstreams. The form above stays editable
// so the PM can fill in title / subtitle / overview before clicking
// the CTAs here to bootstrap structure.
//
// The two onCreate callbacks are owned by EditorShell — same Server
// Actions the StructureSidebar bottom CTAs call. Lifting them avoids
// duplicating the create-phase / create-orphan-workstream logic in
// two places, and lets the empty state show its own pending state via
// the `pending` flag.
//
// If a similar empty-state shape emerges elsewhere, promote the visual
// chrome to a shared `src/components/ui/EmptyState.tsx` primitive
// receiving { icon, heading, body, actions }. Premature for one
// consumer.
export function EmptyNarrativeState({
  onAddPhase,
  onAddOrphanWorkstream,
  pending,
}: {
  onAddPhase: () => void;
  onAddOrphanWorkstream: () => void;
  pending: boolean;
}) {
  return (
    <Card variant="hero" className="text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-warm-100">
        <Layers className="size-8 text-text-muted" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-xl font-semibold text-text-primary">
        Esta narrativa está vacía
      </h3>
      <p className="mx-auto mt-2 max-w-md text-base text-text-secondary">
        Empezá agregando una fase o un workstream sin fase. Podés seguir
        editando el título, subtítulo y overview de arriba mientras tanto.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="primary"
          size="md"
          onClick={onAddPhase}
          disabled={pending}
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar primera fase
        </Button>
        <Button
          variant="secondary"
          size="md"
          onClick={onAddOrphanWorkstream}
          disabled={pending}
        >
          <Plus className="size-4" aria-hidden="true" />
          Workstream sin fase
        </Button>
      </div>
    </Card>
  );
}
