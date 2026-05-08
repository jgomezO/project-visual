"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface AutoSaveResult {
  state: SaveState;
  errorMessage: string | null;
  lastSavedAt: number | null;
  flush: () => Promise<{ ok: boolean }>;
  retry: () => void;
}

interface Options {
  debounceMs?: number;
  onStateChange?: (state: SaveState) => void;
}

/**
 * Debounced auto-save with imperative `flush()` for navigation guards.
 *
 * - Schedules a save `debounceMs` (default 1500) after the latest draft change.
 * - `flush()` cancels the pending timer, awaits any in-flight save, then
 *   triggers a save synchronously if there are still unsaved changes.
 *   Resolves with `{ ok: true }` on success or `{ ok: false }` on error.
 * - `retry()` re-runs the last save attempt (used by the indicator's
 *   "Reintentar" button on `state === 'error'`).
 *
 * Equality is shallow (top-level keys) — fine for the form drafts in this
 * editor, none of which contain nested objects.
 */
export function useAutoSave<T extends object>(
  draft: T,
  saveFn: (draft: T) => Promise<void>,
  options?: Options,
): AutoSaveResult {
  const debounceMs = options?.debounceMs ?? 1500;

  const [state, setStateRaw] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const draftRef = useRef<T>(draft);
  const lastSavedDraftRef = useRef<T>(draft);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);
  const saveFnRef = useRef(saveFn);
  const onStateChangeRef = useRef(options?.onStateChange);

  /* eslint-disable react-hooks/refs -- latest-value ref pattern for the autosave callback chain. The flush() and retry() callbacks need the freshest draft / saveFn / onStateChange snapshot WITHOUT being recreated on every render (which would re-arm the debounce timer). React 19's rules-of-refs flags writes-during-render as antipattern; canonical replacements (useEffectEvent, deps-tracked closures) are non-trivial here because the timing matters synchronously for tab-close and navigate-away flushes. TODO post-iter-8: revisit when useEffectEvent ships stable. */
  draftRef.current = draft;
  saveFnRef.current = saveFn;
  onStateChangeRef.current = options?.onStateChange;
  /* eslint-enable react-hooks/refs */

  const setState = useCallback((next: SaveState) => {
    setStateRaw(next);
    onStateChangeRef.current?.(next);
  }, []);

  const performSave = useCallback(async (): Promise<void> => {
    if (inflightRef.current) {
      // Already saving; let the current save complete. The next draft
      // change will trigger another save via the effect.
      await inflightRef.current;
      return;
    }
    const snapshot = draftRef.current;
    setState("saving");
    const promise = saveFnRef.current(snapshot)
      .then(() => {
        lastSavedDraftRef.current = snapshot;
        setLastSavedAt(Date.now());
        setErrorMessage(null);
        setState("saved");
      })
      .catch((err: unknown) => {
        setErrorMessage(
          err instanceof Error ? err.message : "Error desconocido",
        );
        setState("error");
      });
    inflightRef.current = promise;
    try {
      await promise;
    } finally {
      inflightRef.current = null;
    }
  }, [setState]);

  // Schedule a debounced save when the draft diverges from the last saved
  // value. Cancellation: any subsequent draft change clears the timer.
  useEffect(() => {
    if (shallowEqual(draft, lastSavedDraftRef.current)) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void performSave();
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draft, debounceMs, performSave]);

  const flush = useCallback(async (): Promise<{ ok: boolean }> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (inflightRef.current) {
      await inflightRef.current;
    }
    if (!shallowEqual(draftRef.current, lastSavedDraftRef.current)) {
      await performSave();
    }
    // Read state synchronously via lastSavedDraftRef; if save failed, the
    // draft still differs from lastSavedDraft.
    const ok = shallowEqual(draftRef.current, lastSavedDraftRef.current);
    return { ok };
  }, [performSave]);

  const retry = useCallback(() => {
    void performSave();
  }, [performSave]);

  return { state, errorMessage, lastSavedAt, flush, retry };
}

function shallowEqual<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a) as (keyof T)[];
  const bKeys = Object.keys(b) as (keyof T)[];
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    const av = a[k];
    const bv = b[k];
    if (av === bv) continue;
    // Treat arrays element-equal at the same length to handle
    // jira_issue_keys without false positives.
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length) return false;
      for (let i = 0; i < av.length; i++) {
        if (av[i] !== bv[i]) return false;
      }
      continue;
    }
    return false;
  }
  return true;
}
