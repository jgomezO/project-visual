"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { relativeFromNow } from "@/lib/format/relativeTime";
import type { SaveState } from "./useAutoSave";

// Compact pill-style status read-out for the editor header. Three live
// states (saving / saved / error) plus an idle no-op. Iter 4h R3 polish:
// Prism functional palette, AlertCircle icon for error (was AlertTriangle —
// AlertCircle is the canonical "needs attention" affordance vs AlertTriangle
// which is a heavier "danger" cue we reserve for actual destructive paths).
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
        Guardando…
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
        Error al guardar
        {errorMessage ? (
          <span className="text-text-muted">— {errorMessage}</span>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Reintentar
        </Button>
      </span>
    );
  }
  if (state === "saved" && lastSavedAt) {
    const iso = new Date(lastSavedAt).toISOString();
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-success"
        role="status"
      >
        <Check className="size-3.5" aria-hidden="true" />
        Guardado {relativeFromNow(iso)}
      </span>
    );
  }
  return null;
}
