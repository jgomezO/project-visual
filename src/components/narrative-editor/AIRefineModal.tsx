"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button as HeroButton, Modal } from "@heroui/react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { useWorkstreamDescriptionAI } from "./useWorkstreamDescriptionAI";

interface Props {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  workstreamId: string;
  narrativeId: string;
  issueKeys: string[];
  // The description text the user already had when they clicked
  // "Refine with AI". Stays visible in the left column for compare.
  originalText: string;
  // Called with the trimmed refined text when the user picks
  // "Use refined version". The caller is expected to apply the
  // text to its own form state.
  onAccept: (refinedText: string) => void;
}

// AI refinement modal (iter 7 commit 6). Split-view: user's original
// text on the left (static), AI refined version streaming on the
// right. Three terminal actions in the footer:
//   - Keep original: close, no change.
//   - Refine again: re-run the same prompt (NOT compounding — uses
//     `originalText` again, not the previous refined output, per
//     iter 7 plan E).
//   - Use refined version: apply refined text, close.
//
// Auto-starts streaming on open. Abort fires on close (HeroUI's
// Modal.CloseTrigger / backdrop dismiss / programmatic
// onOpenChange(false)) so the route handler logs the row as
// status='cancelled' on its side.
export function AIRefineModal({
  isOpen,
  onOpenChange,
  workstreamId,
  narrativeId,
  issueKeys,
  originalText,
  onAccept,
}: Props) {
  const t = useTranslations("narratives.ai.modal");
  const locale = useLocale() as Locale;
  const ai = useWorkstreamDescriptionAI();
  const [refinedText, setRefinedText] = useState("");

  // Auto-start streaming when the modal opens. Cleanup aborts the
  // in-flight request when the modal closes mid-stream — the route
  // handler catches the abort, logs status='cancelled', and the
  // partial text is discarded (the modal unmounts).
  useEffect(() => {
    if (!isOpen) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset prior refined text on modal reopen so a second invocation starts blank. TODO post-iter-8: drive via a `key` prop on the modal so React unmounts + remounts and the state initializer handles the reset cleanly.
    setRefinedText("");
    ai.clearError();
    void ai.start({
      workstreamId,
      narrativeId,
      issueKeys,
      currentText: originalText,
      locale,
      onChunk: (delta) => setRefinedText((s) => s + delta),
    });

    return () => {
      ai.abort();
    };
    // Intentionally minimal deps. Re-running on identifier prop changes
    // would interrupt an in-flight refine for no gain — the user can
    // close + reopen to retarget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isStreaming = ai.state === "streaming";
  const isError = ai.state === "error";
  const hasRefined = refinedText.trim().length > 0 && !isError;

  function handleRefineAgain(): void {
    if (isStreaming) return;
    setRefinedText("");
    ai.clearError();
    void ai.start({
      workstreamId,
      narrativeId,
      issueKeys,
      currentText: originalText,
      locale,
      onChunk: (delta) => setRefinedText((s) => s + delta),
    });
  }

  function handleAccept(): void {
    if (!hasRefined) return;
    onAccept(refinedText.trim());
    onOpenChange(false);
  }

  function handleKeep(): void {
    onOpenChange(false);
  }

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-3xl">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{t("title")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <div className="grid gap-3 sm:grid-cols-2">
              <Column label={t("originalLabel")}>
                <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                  {originalText}
                </p>
              </Column>
              <Column label={t("refinedLabel")}>
                {isError ? (
                  <p className="text-sm text-error" role="alert">
                    {ai.errorMessage}
                  </p>
                ) : refinedText.length === 0 && isStreaming ? (
                  <p className="text-sm italic text-text-muted">
                    {t("streamingPlaceholder")}
                  </p>
                ) : (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
                    {refinedText}
                    {isStreaming ? (
                      // Subtle cursor blink while streaming. 1px-wide
                      // vertical bar, no font dependency.
                      <span
                        aria-hidden="true"
                        className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-text-primary animate-pulse motion-reduce:animate-none"
                      />
                    ) : null}
                  </p>
                )}
              </Column>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <HeroButton variant="secondary" onPress={handleKeep}>
              {t("keepOriginal")}
            </HeroButton>
            <HeroButton
              variant="secondary"
              onPress={handleRefineAgain}
              isDisabled={isStreaming}
            >
              {t("refineAgain")}
            </HeroButton>
            <HeroButton
              onPress={handleAccept}
              isDisabled={!hasRefined || isStreaming}
            >
              {t("useRefined")}
            </HeroButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

// Bordered card with a uppercase caption and the body content. Used
// twice inside the modal body (original | refined) — light warm
// wash so the modal doesn't feel flat against the white surface.
function Column({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-h-[8rem] flex-col gap-2 rounded-lg border border-border bg-warm-50/40 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </h3>
      <div className="flex-1">{children}</div>
    </section>
  );
}
