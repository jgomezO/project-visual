"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import type { SaveState } from "./useAutoSave";

// Compact pill-style status read-out for the editor header. Three live
// states (saving / saved / error) plus an idle no-op. Iter 4h R3 polish:
// Prism functional palette, AlertCircle icon for error (was AlertTriangle —
// AlertCircle is the canonical "needs attention" affordance vs AlertTriangle
// which is a heavier "danger" cue we reserve for actual destructive paths).
//
// iter 5 (i18n): drops the local `relativeFromNow` helper for
// `useFormatter().relativeTime()` which respects the active locale.
export function AutosaveIndicator({
  state,
  lastSavedAt,
  errorMessage,
  onRetry,
}: {
  state: SaveState;
  lastSavedAt: number | null;
  errorMessage: string | null;
  onRetry: () => void;
}) {
  const t = useTranslations("narratives.editor.autosave");
  const format = useFormatter();

  if (state === "saving") {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-text-secondary"
        role="status"
      >
        <Loader2
          className="size-3.5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        {t("saving")}
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        className="inline-flex items-center gap-2 text-xs text-error"
        role="alert"
      >
        <AlertCircle className="size-3.5" aria-hidden="true" />
        {t("errorTitle")}
        {errorMessage ? (
          <span className="text-text-muted">— {errorMessage}</span>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onRetry}>
          {t("retry")}
        </Button>
      </span>
    );
  }
  if (state === "saved" && lastSavedAt) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-success"
        role="status"
      >
        <Check className="size-3.5" aria-hidden="true" />
        {t("saved", { time: format.relativeTime(new Date(lastSavedAt)) })}
      </span>
    );
  }
  return null;
}
