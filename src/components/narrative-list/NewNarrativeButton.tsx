"use client";

import { useState, useTransition } from "react";
import {
  Button as HeroButton,
  Input,
  Label,
  Modal,
  TextField,
} from "@heroui/react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { createNarrativeAction } from "@/app/actions/narratives";
import { Button } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";

const TITLE_MAX = 200;
const SUBTITLE_MAX = 200;

export function NewNarrativeButton({
  projectKey,
  projectId,
  ctaLabelOverride,
}: {
  projectKey: string;
  projectId: string;
  // Lets the empty-state pass "Create first narrative" instead of the
  // default "New narrative". Defaults to the t() value below.
  ctaLabelOverride?: string;
}) {
  const t = useTranslations("narratives.list.newButton");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ctaLabel = ctaLabelOverride ?? t("cta");

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
      setError(t("errors.titleRequired"));
      return;
    }
    if (trimmedTitle.length > TITLE_MAX) {
      setError(t("errors.titleTooLong", { max: TITLE_MAX }));
      return;
    }
    if (subtitle.length > SUBTITLE_MAX) {
      setError(t("errors.subtitleTooLong", { max: SUBTITLE_MAX }));
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
        });
        setIsOpen(false);
        reset();
        router.push(
          `/projects/${projectKey}/narratives/${created.id}/edit`,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("errors.unknown");
        setError(t("errors.createFailed", { message }));
      }
    });
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        {ctaLabel}
      </Button>

      <Modal.Backdrop isOpen={isOpen} onOpenChange={handleClose}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t("modal.heading")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col gap-4">
                <TextField>
                  <Label>{t("modal.title.label")}</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.currentTarget.value)}
                    placeholder={t("modal.title.placeholder")}
                    maxLength={TITLE_MAX}
                    autoFocus
                  />
                </TextField>
                <TextField>
                  <Label>{t("modal.subtitle.label")}</Label>
                  <Input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.currentTarget.value)}
                    placeholder={t("modal.subtitle.placeholder")}
                    maxLength={SUBTITLE_MAX}
                  />
                </TextField>
                {error ? (
                  <p className="text-sm text-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <HeroButton
                slot="close"
                variant="secondary"
                isDisabled={pending}
              >
                {t("modal.cancel")}
              </HeroButton>
              <HeroButton onPress={handleCreate} isDisabled={pending}>
                {pending ? t("modal.create.pending") : t("modal.create.idle")}
              </HeroButton>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
