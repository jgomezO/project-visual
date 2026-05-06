"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Desktop nav items for the Topbar. usePathname forces this to a Client
// Component; the Topbar itself stays a Server Component and slots us in.
//
// "Proyectos" matches the entire /projects subtree so the active state
// stays on while the user drills into a project detail or its narrative
// editor. "Settings" is a placeholder until that surface exists — a
// real <button disabled> rather than a fake <Link>, so keyboard tab
// stops are correct and screen readers announce it as a disabled control.
export function TopbarNav() {
  const pathname = usePathname();
  const projectsActive =
    pathname === "/projects" || pathname.startsWith("/projects/");

  return (
    <nav
      className="hidden items-center gap-1 md:flex"
      aria-label="Navegación principal"
    >
      <Link
        href="/projects"
        aria-current={projectsActive ? "page" : undefined}
        className={
          projectsActive
            ? "rounded-md bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700"
            : "rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-warm-50 hover:text-text-primary"
        }
      >
        Proyectos
      </Link>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Próximamente"
        className="ml-1 inline-flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-text-muted opacity-60"
      >
        Settings
        <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warm-700">
          Próximamente
        </span>
      </button>
    </nav>
  );
}
