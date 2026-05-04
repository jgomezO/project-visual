"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Dropdown,
  Label,
  Modal,
  Tooltip,
} from "@heroui/react";
import { ExternalLink, MoreHorizontal } from "lucide-react";
import {
  deleteNarrativeAction,
  duplicateNarrativeAction,
} from "@/app/actions/narratives";
import { relativeFromNow } from "@/lib/format/relativeTime";
import type { ProjectNarrative } from "@/lib/narratives/types";

export function NarrativeCard({
  projectKey,
  narrative,
}: {
  projectKey: string;
  narrative: ProjectNarrative;
}) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const editHref = `/projects/${projectKey}/narratives/${narrative.id}/edit`;
  const previewHref = `/projects/${projectKey}/narratives/${narrative.id}/preview`;

  function handleMenuAction(key: React.Key) {
    if (key === "duplicate") {
      startTransition(async () => {
        try {
          const copy = await duplicateNarrativeAction(
            projectKey,
            narrative.id,
          );
          router.push(`/projects/${projectKey}/narratives/${copy.id}/edit`);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : "Error al duplicar",
          );
        }
      });
    } else if (key === "delete") {
      setConfirmDelete(true);
    }
  }

  function handleConfirmDelete() {
    startTransition(async () => {
      try {
        await deleteNarrativeAction(projectKey, narrative.id);
        setConfirmDelete(false);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al eliminar",
        );
      }
    });
  }

  return (
    <>
      <Card className="relative h-full">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={editHref}
            className="-m-3 flex-1 rounded-2xl p-3 hover:bg-default-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{narrative.title}</h2>
              <PublishedBadge published={narrative.published} />
            </div>
            {narrative.subtitle ? (
              <p className="mt-1 text-sm text-muted">{narrative.subtitle}</p>
            ) : null}
            <p className="mt-3 text-xs text-muted">
              Última edición {relativeFromNow(narrative.updated_at)}
              {narrative.updated_by
                ? ` · por ${narrative.updated_by}`
                : ""}
            </p>
          </Link>
          <Dropdown>
            <Button
              isIconOnly
              variant="tertiary"
              aria-label="Acciones"
              isDisabled={pending}
            >
              <MoreHorizontal className="size-4" />
            </Button>
            <Dropdown.Popover>
              <Dropdown.Menu onAction={handleMenuAction}>
                <Dropdown.Item id="duplicate" textValue="Duplicar">
                  <Label>Duplicar</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  id="delete"
                  textValue="Eliminar"
                  variant="danger"
                >
                  <Label>Eliminar</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <PreviewLink
            published={narrative.published}
            href={previewHref}
          />
        </div>

        {error ? (
          <p className="mt-3 text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </Card>

      <ConfirmDeleteModal
        isOpen={confirmDelete}
        onOpenChange={(open) => {
          if (!pending) setConfirmDelete(open);
        }}
        onConfirm={handleConfirmDelete}
        pending={pending}
      />
    </>
  );
}

function PublishedBadge({ published }: { published: boolean }) {
  if (published) {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Publicada
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
      Borrador
    </span>
  );
}

function PreviewLink({
  published,
  href,
}: {
  published: boolean;
  href: string;
}) {
  if (!published) {
    return (
      <Tooltip delay={150}>
        <span tabIndex={0} aria-disabled="true">
          <Button variant="secondary" size="sm" isDisabled>
            <ExternalLink className="size-3.5" />
            Vista previa
          </Button>
        </span>
        <Tooltip.Content>
          <p className="text-xs">
            Publicá la narrativa para previsualizarla.
          </p>
        </Tooltip.Content>
      </Tooltip>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-default-300 bg-surface px-3 py-1 text-xs font-medium hover:bg-default-50"
    >
      <ExternalLink className="size-3.5" />
      Vista previa
    </a>
  );
}

function ConfirmDeleteModal({
  isOpen,
  onOpenChange,
  onConfirm,
  pending,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>¿Eliminar narrativa?</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-sm text-muted">
              Esta acción no se puede deshacer. Se eliminarán también las
              fases y workstreams asociados.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary" isDisabled={pending}>
              Cancelar
            </Button>
            <Button onPress={onConfirm} isDisabled={pending}>
              {pending ? "Eliminando…" : "Eliminar"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
