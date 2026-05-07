"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button as HeroButton,
  Dropdown,
  Label,
  Modal,
  Tooltip,
} from "@heroui/react";
import { AlertTriangle, ExternalLink, MoreHorizontal } from "lucide-react";
import {
  deleteNarrativeAction,
  duplicateNarrativeAction,
} from "@/app/actions/narratives";
import { Button, Card, Chip } from "@/components/ui";
import { formatActor } from "@/lib/format/actor";
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
            className="-m-3 flex-1 rounded-2xl p-3 transition-colors hover:bg-warm-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-text-primary">
                {narrative.title}
              </h3>
              <PublishedBadge published={narrative.published} />
            </div>
            {narrative.subtitle ? (
              <p className="mt-1 text-sm text-text-secondary">
                {narrative.subtitle}
              </p>
            ) : null}
            <p className="mt-3 text-xs text-text-muted">
              Última edición {relativeFromNow(narrative.updated_at)}
              {" · por "}
              {formatActor(narrative.updated_by)}
            </p>
          </Link>
          <Dropdown>
            <HeroButton
              isIconOnly
              variant="tertiary"
              aria-label="Acciones"
              isDisabled={pending}
            >
              <MoreHorizontal className="size-4" />
            </HeroButton>
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
          <p className="mt-3 text-xs text-error" role="alert">
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
    return <Chip variant="status-done">Publicada</Chip>;
  }
  return <Chip variant="status-todo">Borrador</Chip>;
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
          <Button variant="secondary" size="sm" disabled>
            <ExternalLink className="size-3.5" aria-hidden="true" />
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
  // Anchor mimicking the secondary Button — needs the target/rel pair
  // for "open preview in a new tab", which Button (a real <button>)
  // can't express on its own.
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-warm-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
    >
      <ExternalLink className="size-3.5" aria-hidden="true" />
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
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-error-bg"
              >
                <AlertTriangle className="size-5 text-error" />
              </span>
              <Modal.Heading>¿Eliminar narrativa?</Modal.Heading>
            </div>
          </Modal.Header>
          <Modal.Body>
            <p className="text-base text-text-secondary">
              Esta acción no se puede deshacer. Se eliminarán también las
              fases, workstreams, dependencias y riesgos asociados.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <HeroButton slot="close" variant="secondary" isDisabled={pending}>
              Cancelar
            </HeroButton>
            <HeroButton onPress={onConfirm} isDisabled={pending}>
              {pending ? "Eliminando…" : "Eliminar"}
            </HeroButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
