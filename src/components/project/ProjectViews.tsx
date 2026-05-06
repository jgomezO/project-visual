"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProjectRoadmap } from "./ProjectRoadmap";
import { ProjectTable, type IssueRow } from "./ProjectTable";

export type ViewKey = "list" | "roadmap" | "narratives";

const TAB_DEFS: { id: ViewKey; label: string }[] = [
  { id: "list", label: "Lista" },
  { id: "roadmap", label: "Roadmap" },
  { id: "narratives", label: "Narrativas" },
];

const VIEW_KEYS: readonly ViewKey[] = TAB_DEFS.map((t) => t.id);

function isViewKey(value: unknown): value is ViewKey {
  return (
    typeof value === "string" &&
    (VIEW_KEYS as readonly string[]).includes(value)
  );
}

// Custom tab bar replacing HeroUI Tabs (iter 4h R2). Underline-style
// — active tab gets a 2px primary-500 bottom border that fades in via
// transition-colors, no sliding indicator (sliding would need to
// measure positions with refs + useLayoutEffect for a marginal visual
// gain). Active state lives in the URL (?view=...) like before, so a
// shared link still deep-links into the right tab. Conditional render
// of the panel — when you switch tabs, the prior tab's component
// state (filter toggles, selected drawer issue) is dropped, same as
// HeroUI Tabs's behavior on a soft navigation.
//
// Keyboard nav: ArrowRight / ArrowLeft cycle through tabs. Only the
// active tab is in the natural tab order (tabIndex=0); inactive tabs
// are skipped (tabIndex=-1) per WAI-ARIA Tabs pattern, with arrow
// keys moving focus + selection within the tablist.
export function ProjectViews({
  rows,
  view,
  narrativesPanel,
}: {
  rows: IssueRow[];
  view: ViewKey;
  narrativesPanel: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (next: ViewKey) => {
    if (next === view) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "list") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % TAB_DEFS.length;
    else if (e.key === "ArrowLeft")
      nextIndex = (index - 1 + TAB_DEFS.length) % TAB_DEFS.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = TAB_DEFS.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const next = TAB_DEFS[nextIndex];
    select(next.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Vista del proyecto"
        className="flex gap-2 border-b border-border"
      >
        {TAB_DEFS.map((tab, index) => {
          const active = tab.id === view;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-controls={`panel-${tab.id}`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => {
                if (!isViewKey(tab.id)) return;
                select(tab.id);
              }}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={
                active
                  ? "-mb-px border-b-2 border-primary-500 px-4 py-3 text-sm font-medium text-text-primary transition-colors"
                  : "-mb-px border-b-2 border-transparent px-4 py-3 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`panel-${view}`}
        aria-labelledby={`tab-${view}`}
        className="pt-6"
      >
        {view === "list" && <ProjectTable rows={rows} />}
        {view === "roadmap" && <ProjectRoadmap rows={rows} />}
        {view === "narratives" && narrativesPanel}
      </div>
    </div>
  );
}
