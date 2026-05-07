import { AlertCircle } from "lucide-react";

export function DraftBanner() {
  return (
    <div
      data-print="hide"
      className="border-b border-warning/40 bg-warning-bg px-6 py-2"
    >
      <div className="mx-auto flex max-w-[1200px] items-center gap-2 text-sm text-text-primary">
        <AlertCircle
          className="size-4 shrink-0 text-warning"
          aria-hidden="true"
        />
        <span>
          <strong className="font-semibold">Vista previa</strong> — Esta
          narrativa aún no está publicada. Sólo personas con el link la pueden
          ver.
        </span>
      </div>
    </div>
  );
}
