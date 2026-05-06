"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer } from "@heroui/react";
import { Menu } from "lucide-react";

// Mobile (sub-md) collapse for the Topbar nav. Hamburger button on the
// right edge of the topbar opens a left-side Drawer with the same items
// the desktop TopbarNav surfaces. Reaches into HeroUI's Drawer compound
// API; the controlled pattern (Drawer.Backdrop with isOpen +
// onOpenChange) matches what IssueDrawer already uses elsewhere.
export function TopbarMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const projectsActive =
    pathname === "/projects" || pathname.startsWith("/projects/");

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Abrir menú de navegación"
        className="inline-flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-warm-50 hover:text-text-primary md:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <Drawer.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => setIsOpen(open)}
      >
        <Drawer.Content placement="left">
          <Drawer.Dialog>
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Drawer.Heading className="text-lg font-bold tracking-tight">
                PRISM
              </Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <nav
                className="flex flex-col gap-1"
                aria-label="Navegación principal"
              >
                <Link
                  href="/projects"
                  onClick={() => setIsOpen(false)}
                  aria-current={projectsActive ? "page" : undefined}
                  className={
                    projectsActive
                      ? "rounded-md bg-primary-50 px-3 py-2 text-base font-medium text-primary-700"
                      : "rounded-md px-3 py-2 text-base font-medium text-text-secondary hover:bg-warm-50 hover:text-text-primary"
                  }
                >
                  Proyectos
                </Link>
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-left text-base font-medium text-text-muted opacity-60"
                >
                  Settings
                  <span className="rounded-full bg-warm-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warm-700">
                    Próximamente
                  </span>
                </button>
              </nav>
            </Drawer.Body>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </>
  );
}
