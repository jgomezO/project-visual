"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { Plus } from "lucide-react";
import { createNarrativeAction } from "@/app/actions/narratives";

const TITLE_MAX = 200;
const SUBTITLE_MAX = 200;

export function NewNarrativeButton({
  projectKey,
  projectId,
  ctaLabel = "Nueva narrativa",
}: {
  projectKey: string;
  projectId: string;
  ctaLabel?: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitle("");
    setSubtitle("");
    setError(null);
  }

  function handleClose(open: boolean) {
    if (!open && !pending) {
      setIsOpen(false);
      reset();
    }
  }

  function handleCreate() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("El título es obligatorio.");
      return;
    }
    if (trimmedTitle.length > TITLE_MAX) {
      setError(`El título no puede superar ${TITLE_MAX} caracteres.`);
      return;
    }
    if (subtitle.length > SUBTITLE_MAX) {
      setError(`El subtítulo no puede superar ${SUBTITLE_MAX} caracteres.`);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const created = await createNarrativeAction(projectKey, {
          project_id: projectId,
          title: trimmedTitle,
          subtitle: subtitle.trim() || null,
          published: false,
          created_by: "system",
          updated_by: "system",
        });
        setIsOpen(false);
        reset();
        router.push(
          `/projects/${projectKey}/narratives/${created.id}/edit`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo crear: ${message}`);
      }
    });
  }

  return (
    <>
      <Button onPress={() => setIsOpen(true)}>
        <Plus className="size-4" />
        {ctaLabel}
      </Button>

      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>Nueva narrativa</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col gap-4">
                <TextField>
                  <Label>Título</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.currentTarget.value)}
                    placeholder="Ej: Ticketing V2 — Phase 0 & Phase 1"
                    maxLength={TITLE_MAX}
                    autoFocus
                  />
                </TextField>
                <TextField>
                  <Label>Subtítulo (opcional)</Label>
                  <Input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.currentTarget.value)}
                    placeholder="Audiencia / contexto / fecha"
                    maxLength={SUBTITLE_MAX}
                  />
                </TextField>
                {error ? (
                  <p className="text-sm text-danger" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button
                slot="close"
                variant="secondary"
                isDisabled={pending}
              >
                Cancelar
              </Button>
              <Button onPress={handleCreate} isDisabled={pending}>
                {pending ? "Creando…" : "Crear y editar"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
