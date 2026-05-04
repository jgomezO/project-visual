"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { ExternalLink } from "lucide-react";
import { publishNarrativeAction } from "@/app/actions/narratives";
import type {
  NarrativePhaseWithWorkstreams,
  NarrativeWithChildren,
  NarrativeWorkstream,
  ProjectNarrative,
} from "@/lib/narratives/types";
import { StructureSidebar } from "./StructureSidebar";

export type SelectedNode =
  | { kind: "narrative" }
  | { kind: "phase"; id: string }
  | { kind: "workstream"; id: string };

const NARRATIVE_NODE: SelectedNode = { kind: "narrative" };

export function EditorShell({
  projectKey,
  projectName,
  initialNarrative,
}: {
  projectKey: string;
  projectName: string;
  initialNarrative: NarrativeWithChildren;
}) {
  const [tree, setTree] = useState<NarrativeWithChildren>(initialNarrative);
  const [selected, setSelected] = useState<SelectedNode>(NARRATIVE_NODE);

  function handleNarrativePatched(next: ProjectNarrative): void {
    setTree((prev) => ({ ...prev, ...next }));
  }

  function handlePhaseListChanged(
    next: NarrativePhaseWithWorkstreams[],
  ): void {
    setTree((prev) => ({ ...prev, phases: next }));
  }

  function handleOrphansChanged(next: NarrativeWorkstream[]): void {
    setTree((prev) => ({ ...prev, orphan_workstreams: next }));
  }

  return (
    <>
      <div className="md:hidden p-8 text-center">
        <h1 className="text-lg font-semibold">
          Editor disponible en pantallas más anchas
        </h1>
        <p className="mt-2 text-sm text-muted">
          Volvé a abrir esta página desde una notebook o pantalla de
          escritorio. El editor de narrativas necesita más espacio del
          que tiene tu dispositivo actual.
        </p>
        <Link
          href={`/projects/${projectKey}/narratives`}
          className="mt-4 inline-block text-sm underline"
        >
          Volver al listado
        </Link>
      </div>

      <main className="hidden md:flex md:flex-col h-[calc(100vh)] overflow-hidden">
        <EditorHeader
          projectKey={projectKey}
          projectName={projectName}
          narrative={tree}
          onPublishedChanged={handleNarrativePatched}
        />
        <div className="flex flex-1 overflow-hidden border-t border-default-200">
          <aside className="flex w-80 shrink-0 flex-col border-r border-default-200 bg-surface">
            <StructureSidebar
              tree={tree}
              selected={selected}
              onSelect={setSelected}
              onNarrativePatched={handleNarrativePatched}
              onPhaseListChanged={handlePhaseListChanged}
              onOrphansChanged={handleOrphansChanged}
            />
          </aside>
          <section className="flex-1 overflow-y-auto p-6">
            <FormPanelPlaceholder selected={selected} />
          </section>
        </div>
      </main>
    </>
  );
}

function EditorHeader({
  projectKey,
  projectName,
  narrative,
  onPublishedChanged,
}: {
  projectKey: string;
  projectName: string;
  narrative: NarrativeWithChildren;
  onPublishedChanged: (next: ProjectNarrative) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const previewHref = `/projects/${projectKey}/narratives/${narrative.id}/preview`;

  function handlePublishToggle(): void {
    const goingToDraft = narrative.published;
    if (goingToDraft) {
      const ok = window.confirm(
        "¿Despublicar esta narrativa? Dejará de ser visible en la vista pública.",
      );
      if (!ok) return;
    }
    startTransition(async () => {
      try {
        const next = await publishNarrativeAction(
          projectKey,
          narrative.id,
          !narrative.published,
        );
        onPublishedChanged(next);
        if (!goingToDraft) {
          // Going from draft → published. Send the user back to the list
          // so they see the badge change without ambiguity.
          router.push(`/projects/${projectKey}/narratives`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al publicar";
        window.alert(msg);
      }
    });
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/projects" className="hover:underline">
          Proyectos
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/projects/${projectKey}`}
          className="hover:underline"
        >
          {projectName}
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          href={`/projects/${projectKey}/narratives`}
          className="hover:underline"
        >
          Narrativas
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-foreground">{narrative.title}</span>
      </nav>
      <div className="flex items-center gap-2">
        <a
          href={previewHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-default-300 bg-surface px-3 py-1.5 text-sm hover:bg-default-50"
        >
          <ExternalLink className="size-4" />
          Vista previa
        </a>
        <Button
          variant={narrative.published ? "secondary" : undefined}
          isDisabled={pending}
          onPress={handlePublishToggle}
        >
          {pending
            ? "Aplicando…"
            : narrative.published
              ? "Despublicar"
              : "Publicar"}
        </Button>
      </div>
    </header>
  );
}

function FormPanelPlaceholder({ selected }: { selected: SelectedNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-default-300 p-10 text-center text-sm text-muted">
      Formulario de {selected.kind} próximamente (commit 3).
    </div>
  );
}
