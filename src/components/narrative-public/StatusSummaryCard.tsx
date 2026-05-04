import { Activity } from "lucide-react";

export function StatusSummaryCard({ text }: { text: string }) {
  return (
    <section
      aria-labelledby="status-summary-heading"
      className="rounded-xl border-l-4 border-blue-500 bg-blue-50/60 p-5 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700"
        >
          <Activity className="size-4" />
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          <h2
            id="status-summary-heading"
            className="text-xs font-semibold uppercase tracking-wide text-blue-700"
          >
            Estado actual
          </h2>
          <p className="whitespace-pre-line text-base leading-relaxed text-foreground group-data-[mode=presentation]/preview:text-lg">
            {text}
          </p>
        </div>
      </div>
    </section>
  );
}
