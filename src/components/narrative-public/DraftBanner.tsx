import { AlertTriangle } from "lucide-react";

export function DraftBanner() {
  return (
    <div
      data-print="hide"
      className="border-b border-amber-300 bg-amber-50 px-6 py-2"
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-2 text-sm text-amber-900">
        <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">Vista previa</strong> — Esta
          narrativa aún no está publicada. Sólo personas con el link la pueden
          ver.
        </span>
      </div>
    </div>
  );
}
