"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";

export type AIStreamState = "idle" | "streaming" | "error";

interface StartArgs {
  workstreamId: string;
  narrativeId: string;
  issueKeys: string[];
  // Present + non-empty → 'refine'; absent / empty → 'generate'.
  // The route handler decides operation server-side.
  currentText?: string;
  locale: Locale;
  // Per-chunk callback. Caller is responsible for applying the delta
  // wherever it makes sense (draft state, modal column, etc.).
  onChunk: (delta: string) => void;
  // Terminal callbacks (one of the two fires for every start).
  onComplete?: () => void;
  onError?: (message: string) => void;
}

// Hook owning the SSE consumer for /api/ai/workstream-description.
//
// One in-flight stream per hook instance. Calling start() while a
// previous stream is alive aborts the old one (defensive — the
// consuming UI typically gates with a disabled button).
//
// Cleanup: AbortController fires on unmount, so navigating away from
// the editor or closing the modal kills the in-flight request. The
// route handler logs the row as status='cancelled' on its side.
//
// Wire format: each SSE frame is `data: <json>\n\n` with one of three
// types (chunk / done / error) — must stay in lockstep with
// src/app/api/ai/workstream-description/route.ts:sseFrame.
export function useWorkstreamDescriptionAI() {
  const tErrors = useTranslations("narratives.ai.errors");
  const [state, setState] = useState<AIStreamState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const start = useCallback(
    async (args: StartArgs) => {
      // Abort any prior in-flight stream from the same hook instance.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState("streaming");
      setErrorMessage(null);

      const mapHttpStatus = (status: number): string => {
        if (status === 401) return tErrors("unauthorized");
        if (status === 404) return tErrors("issuesNotFound");
        if (status === 429) return tErrors("rateLimited");
        if (status >= 500) return tErrors("serviceUnavailable");
        return tErrors("generic");
      };

      try {
        const response = await fetch("/api/ai/workstream-description", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workstreamId: args.workstreamId,
            narrativeId: args.narrativeId,
            issueKeys: args.issueKeys,
            currentText: args.currentText,
            locale: args.locale,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const msg = mapHttpStatus(response.status);
          setErrorMessage(msg);
          setState("error");
          args.onError?.(msg);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          const msg = tErrors("generic");
          setErrorMessage(msg);
          setState("error");
          args.onError?.(msg);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let terminated = false;

        // SSE frame loop. Each iteration of the outer reader.read pulls
        // a network chunk; the inner while drains complete frames out
        // of the buffer (separator: \n\n). Partial frames stay in the
        // buffer for the next read.
        while (!terminated) {
          const { value, done: streamDone } = await reader.read();
          if (streamDone) break;
          buffer += decoder.decode(value, { stream: true });

          let sepIdx: number;
          while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);

            if (!frame.startsWith("data: ")) continue;
            const json = frame.slice(6);
            try {
              const event = JSON.parse(json) as
                | { type: "chunk"; delta: string }
                | { type: "done"; usage: unknown }
                | { type: "error"; message: string };

              if (event.type === "chunk") {
                args.onChunk(event.delta);
              } else if (event.type === "done") {
                setState("idle");
                args.onComplete?.();
                terminated = true;
                break;
              } else if (event.type === "error") {
                const msg = event.message || tErrors("generic");
                setErrorMessage(msg);
                setState("error");
                args.onError?.(msg);
                terminated = true;
                break;
              }
            } catch {
              // Malformed JSON in a frame — skip and keep parsing.
            }
          }
        }
      } catch (e) {
        // AbortError = caller cancelled (unmount, manual abort). Treat
        // as terminal-but-not-an-error; the route handler logs its own
        // ai_usage row with status='cancelled'.
        if (e instanceof Error && e.name === "AbortError") {
          setState("idle");
          return;
        }
        const msg = tErrors("generic");
        setErrorMessage(msg);
        setState("error");
        args.onError?.(msg);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [tErrors],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    if (state === "error") setState("idle");
  }, [state]);

  return { state, errorMessage, start, abort, clearError };
}
