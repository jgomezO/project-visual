"use client";

import { Button } from "@heroui/react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { relativeFromNow } from "@/lib/format/relativeTime";
import type { SaveState } from "./useAutoSave";

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
      <span className="inline-flex items-center gap-1.5 text-xs text-muted">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        Guardando…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-danger">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        Error al guardar
        {errorMessage ? (
          <span className="font-mono text-[10px] opacity-70">
            {errorMessage}
          </span>
        ) : null}
        <Button size="sm" variant="tertiary" onPress={onRetry}>
          Reintentar
        </Button>
      </span>
    );
  }
  if (state === "saved" && lastSavedAt) {
    const iso = new Date(lastSavedAt).toISOString();
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
        <Check className="size-3.5" aria-hidden="true" />
        Guardado {relativeFromNow(iso)}
      </span>
    );
  }
  return null;
}
