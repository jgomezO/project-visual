import { Activity } from "lucide-react";
import { getTranslations } from "next-intl/server";

// Prism Card-shaped surface (rounded-2xl + shadow-md + p-6) with a
// lavender lateral border. We don't use the <Card> primitive directly
// because we need a <section> for the aria-labelledby relationship —
// Card renders a <div> and isn't polymorphic. Tokens match the Card
// `default` variant so the visual stays in lockstep.
export async function StatusSummaryCard({ text }: { text: string }) {
  const t = await getTranslations("preview.statusSummary");
  return (
    <section
      aria-labelledby="status-summary-heading"
      className="rounded-2xl border-l-4 border-primary-500 bg-primary-50/40 p-6 shadow-md"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700"
        >
          <Activity className="size-4" />
        </span>
        <div className="flex flex-1 flex-col gap-2">
          <h2
            id="status-summary-heading"
            className="text-xs font-semibold uppercase tracking-wide text-primary-700"
          >
            {t("heading")}
          </h2>
          <p className="whitespace-pre-line text-base leading-relaxed text-text-primary group-data-[mode=presentation]/preview:text-lg">
            {text}
          </p>
        </div>
      </div>
    </section>
  );
}
