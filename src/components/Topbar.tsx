import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { TopbarMobileMenu } from "./TopbarMobileMenu";
import { TopbarNav } from "./TopbarNav";
import { UserMenu } from "./UserMenu";

interface TopbarProps {
  user: { email: string; displayName: string } | null;
}

// Persistent topbar (Prism design system, iter 4h R1). Lives once at
// the (app) layout level — every authenticated page renders inside it,
// the public /preview opts out by living outside the (app) group.
//
// Server Component: receives the resolved user as a prop; the children
// (TopbarNav + TopbarMobileMenu + UserMenu) drop to Client where they
// need pathname / open-state / dropdowns.
//
// The inner container is `max-w-7xl mx-auto px-6` so the nav items
// align horizontally with the page content column underneath, while
// the outer <header> spans full viewport width for the border-bottom
// to read as a continuous rule.
//
// iter 5 (i18n): Link comes from `@/i18n/navigation` so the brand
// anchor automatically resolves with the active locale prefix.
export async function Topbar({ user }: TopbarProps) {
  const t = await getTranslations("topbar");

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-border bg-surface">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/projects"
            className="text-xl font-bold tracking-tight text-text-primary"
            aria-label={t("brand.aria")}
          >
            PRISM
          </Link>
          <TopbarNav />
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {user ? (
            <UserMenu email={user.email} displayName={user.displayName} />
          ) : null}
          <TopbarMobileMenu />
        </div>
      </div>
    </header>
  );
}
