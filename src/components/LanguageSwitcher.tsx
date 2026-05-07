"use client";

import { useSearchParams } from "next/navigation";
import { Button, Dropdown, Label } from "@heroui/react";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

// Compact locale switcher. Two surfaces today (iter 5 c8):
//   - Topbar (between TopbarNav and UserMenu) — visible across every
//     authenticated page.
//   - NarrativeView preview top action bar (next to PresentationModeToggle)
//     — hides automatically in presentation mode via the parent's
//     `group-data-[mode=presentation]/preview:hidden`.
//
// Trigger: 9×9 circle echoing UserMenu, showing the current locale code
// uppercased (EN / ES). Items list the localized native names so a
// non-Spanish reader still sees "Español" and a Spanish reader still
// sees "English" — the affordance reads regardless of which side of
// the switch you're on.
//
// Navigation contract: useRouter().replace(pathname + qs, { locale })
// from `@/i18n/navigation` swaps the URL prefix AND writes the
// NEXT_LOCALE cookie so the choice persists across sessions. We
// preserve the search string explicitly because router.replace only
// takes a single href (not a `{ pathname, query }` shape unless you
// opt into typed routes).
export function LanguageSwitcher() {
  const t = useTranslations("topbar.languageSwitcher");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(key: React.Key) {
    const next = String(key) as Locale;
    if (next === locale) return;
    const qs = searchParams?.toString() ?? "";
    const href = qs ? `${pathname}?${qs}` : pathname;
    router.replace(href, { locale: next });
  }

  return (
    <Dropdown>
      <Button
        isIconOnly
        size="sm"
        aria-label={t("aria")}
        className="size-9 rounded-full bg-default-200 text-xs font-semibold uppercase text-foreground hover:bg-default-300"
      >
        {locale}
      </Button>
      <Dropdown.Popover className="min-w-[10rem]">
        <Dropdown.Menu onAction={handleSelect}>
          {routing.locales.map((loc) => (
            <Dropdown.Item
              key={loc}
              id={loc}
              textValue={t(`options.${loc}` as "options.en" | "options.es")}
            >
              <Label className="flex flex-1 items-center justify-between gap-3">
                <span>
                  {t(`options.${loc}` as "options.en" | "options.es")}
                </span>
                {loc === locale ? (
                  <Check
                    className="size-4 text-primary-700"
                    aria-hidden="true"
                  />
                ) : null}
              </Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
