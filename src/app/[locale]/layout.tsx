import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { routing } from "@/i18n/routing";
import "../globals.css";

// TODO (i18n polish): migrate metadata to a generateMetadata() that
// reads getTranslations('common.metadata'). Static English placeholder
// covers crawlers / share previews until then — this is an internal
// tool so the cost of staying static is low.
export const metadata: Metadata = {
  title: "Prism",
  description:
    "Internal dashboard surfacing Jira project status to non-technical audiences.",
};

// Ahead-of-time render guarantee: pre-build a page for every supported
// locale. Without this, every locale-prefixed URL would render
// dynamically. With it, /en/projects and /es/projects can be cached
// per locale.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Hard 404 on unknown locales — the middleware should never let one
  // through, but defensive: if someone hits /fr/projects directly we
  // want a clean 404 instead of an exception in NextIntlClientProvider.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Required for Server Components to know which locale is active.
  // Pairs with `getTranslations()` / `getFormatter()` calls under
  // this segment.
  setRequestLocale(locale);

  // GeistSans.className sets the font-family directly (so prose inherits
  // Geist by default, no opt-in needed). GeistMono.variable exposes a
  // CSS variable (`--font-geist-mono`) for spots that need monospace —
  // applied via Tailwind's `font-mono` utility once we wire that mapping.
  return (
    <html
      lang={locale}
      className={`${GeistSans.className} ${GeistMono.variable}`}
    >
      <body className="bg-bg text-text-primary antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
