"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Maximize2, Minimize2 } from "lucide-react";

type ViewMode = "normal" | "presentation";

interface Props {
  mode: ViewMode;
}

export function PresentationModeToggle({ mode }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setMode(next: ViewMode): void {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (next === "presentation") {
      params.set("mode", "presentation");
    } else {
      params.delete("mode");
    }
    const qs = params.toString();
    // replace, not push — toggling the mode shouldn't pollute history.
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  // ESC exits presentation mode. No-op outside presentation so we don't
  // intercept Escape keystrokes that other UI (modals, popovers) rely on.
  useEffect(() => {
    if (mode !== "presentation") return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setMode("normal");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const isPresentation = mode === "presentation";
  const Icon = isPresentation ? Minimize2 : Maximize2;

  return (
    <button
      type="button"
      data-print="hide"
      onClick={() => setMode(isPresentation ? "normal" : "presentation")}
      aria-pressed={isPresentation}
      className="inline-flex items-center gap-1.5 rounded-md border border-default-300 bg-surface px-3 py-1.5 text-sm hover:bg-default-50"
      title={isPresentation ? "Salir (ESC)" : "Modo presentación"}
    >
      <Icon className="size-4" aria-hidden="true" />
      {isPresentation ? "Salir" : "Modo presentación"}
    </button>
  );
}
