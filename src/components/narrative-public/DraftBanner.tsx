import { AlertCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function DraftBanner() {
  const t = await getTranslations("preview.draftBanner");
  return (
    <div
      data-print="hide"
      className="border-b border-warning/40 bg-warning-bg px-6 py-2"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 text-sm text-text-primary group-data-[mode=presentation]/preview:max-w-6xl">
        <AlertCircle
          className="size-4 shrink-0 text-warning"
          aria-hidden="true"
        />
        <span>
          <strong className="font-semibold">{t("label")}</strong> — {t("body")}
        </span>
      </div>
    </div>
  );
}
