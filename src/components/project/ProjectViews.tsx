"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@heroui/react";
import { ProjectRoadmap } from "./ProjectRoadmap";
import { ProjectTable, type IssueRow } from "./ProjectTable";

export type ViewKey = "list" | "roadmap";

export function ProjectViews({
  rows,
  view,
}: {
  rows: IssueRow[];
  view: ViewKey;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelectionChange = (key: React.Key) => {
    const next = key === "roadmap" ? "roadmap" : "list";
    if (next === view) return;
    const params = new URLSearchParams(searchParams.toString());
    if (next === "list") {
      params.delete("view");
    } else {
      params.set("view", next);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <Tabs selectedKey={view} onSelectionChange={handleSelectionChange}>
      <Tabs.ListContainer>
        <Tabs.List aria-label="Vista del proyecto">
          <Tabs.Tab id="list">
            Lista
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="roadmap">
            Roadmap
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
      <Tabs.Panel id="list" className="pt-4">
        <ProjectTable rows={rows} />
      </Tabs.Panel>
      <Tabs.Panel id="roadmap" className="pt-4">
        <ProjectRoadmap rows={rows} />
      </Tabs.Panel>
    </Tabs>
  );
}
