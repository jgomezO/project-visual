"use client";

import type { IssueRow } from "./ProjectTable";

export function ProjectRoadmap({ rows: _rows }: { rows: IssueRow[] }) {
  return (
    <div className="rounded-2xl border border-dashed border-default-300 p-10 text-center">
      <p className="text-sm text-muted">Roadmap próximamente.</p>
    </div>
  );
}
