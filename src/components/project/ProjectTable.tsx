"use client";

import { useMemo, useState } from "react";
import { GeistMono } from "geist/font/mono";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { Card, Toggle } from "@/components/ui";
import { AssigneeCell } from "./AssigneeCell";
import { DueDateCell } from "./DueDateCell";
import { IssueDrawer } from "./IssueDrawer";
import { StatusChip } from "./StatusChip";
import { getIssueTypeMeta } from "./issueTypeIcon";

export type StatusCategory = "To Do" | "In Progress" | "Done";

export interface IssueRow {
  id: string;
  key: string;
  summary: string;
  issue_type: string;
  status_name: string;
  status_category: StatusCategory;
  assignee_account_id: string | null;
  assignee_display_name: string | null;
  priority: string | null;
  parent_id: string | null;
  due_date: string | null;
  start_date: string | null;
  updated_at_jira: string | null;
}

interface Buckets {
  epics: IssueRow[];
  childrenByEpic: Map<string, IssueRow[]>;
  orphans: IssueRow[];
}

export function ProjectTable({ rows }: { rows: IssueRow[] }) {
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [onlyWithDueDate, setOnlyWithDueDate] = useState(false);
  const [overrides, setOverrides] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  const [selectedIssue, setSelectedIssue] = useState<IssueRow | null>(null);

  const buckets = useMemo(() => bucketize(rows), [rows]);
  const filtered = useMemo(
    () => filterBuckets(buckets, { showOnlyActive, onlyWithDueDate }),
    [buckets, showOnlyActive, onlyWithDueDate],
  );

  const isExpanded = (epicId: string, def: boolean): boolean =>
    overrides.get(epicId) ?? def;

  const toggleExpand = (epicId: string, def: boolean) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(epicId, !(prev.get(epicId) ?? def));
      return next;
    });
  };

  const handleSelect = (issue: IssueRow) => setSelectedIssue(issue);

  const hasNoIssuesAtAll = rows.length === 0;
  const isEmptyAfterFilter =
    !hasNoIssuesAtAll &&
    filtered.epics.length === 0 &&
    filtered.orphans.length === 0;

  if (hasNoIssuesAtAll) {
    return <NoIssuesEmpty />;
  }

  return (
    <div className="space-y-6">
      <IssueDrawer
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Toggle
          checked={showOnlyActive}
          onChange={setShowOnlyActive}
          label="Solo activas"
        />
        <Toggle
          checked={onlyWithDueDate}
          onChange={setOnlyWithDueDate}
          label="Solo con due date"
        />
      </div>

      {isEmptyAfterFilter ? (
        <FilteredEmpty
          onClear={() => {
            setShowOnlyActive(false);
            setOnlyWithDueDate(false);
          }}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  <th className="px-4 py-3">Summary</th>
                  <th className="w-32 px-4 py-3">Status</th>
                  <th className="w-56 px-4 py-3">Asignado</th>
                  <th className="w-28 px-4 py-3">Vence</th>
                </tr>
              </thead>
              <tbody>
                {filtered.epics.map((epic) => {
                  const kids = filtered.childrenByEpic.get(epic.id) ?? [];
                  const epicIsDone = epic.status_category === "Done";
                  const def = !epicIsDone && kids.length > 0;
                  const expanded = isExpanded(epic.id, def);
                  return (
                    <EpicGroup
                      key={epic.id}
                      epic={epic}
                      kids={kids}
                      expanded={expanded}
                      onToggle={() => toggleExpand(epic.id, def)}
                      onSelect={handleSelect}
                    />
                  );
                })}
                {filtered.orphans.length > 0 && (
                  <OrphansSection
                    orphans={filtered.orphans}
                    onSelect={handleSelect}
                  />
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function EpicGroup({
  epic,
  kids,
  expanded,
  onToggle,
  onSelect,
}: {
  epic: IssueRow;
  kids: IssueRow[];
  expanded: boolean;
  onToggle: () => void;
  onSelect: (issue: IssueRow) => void;
}) {
  const isDone = epic.status_category === "Done";
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const showEmptyEpicBadge = !expanded && kids.length === 0;
  const meta = getIssueTypeMeta(epic.issue_type);

  return (
    <>
      <tr
        className="cursor-pointer border-b border-border transition-colors hover:bg-warm-50"
        onClick={() => onSelect(epic)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={expanded ? "Colapsar épica" : "Expandir épica"}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="rounded p-0.5 text-text-secondary transition-colors hover:bg-warm-100 hover:text-text-primary"
            >
              <Chevron className="size-4" />
            </button>
            <meta.Icon
              className={`size-4 shrink-0 ${meta.colorClass}`}
              aria-hidden="true"
            />
            <span title={meta.label} className="sr-only">
              {meta.label}
            </span>
            <span className={`${GeistMono.className} text-xs text-text-muted`}>
              {epic.key}
            </span>
            <span className="font-semibold text-text-primary">
              {epic.summary}
            </span>
            {isDone ? (
              <CheckCircle2
                className="size-4 text-success"
                aria-label="Épica completada"
              />
            ) : null}
            {showEmptyEpicBadge ? (
              <span className="whitespace-nowrap rounded-full bg-warm-100 px-2 py-0.5 text-xs text-text-muted">
                Sin historias
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3">
          <StatusChip
            category={epic.status_category}
            statusName={epic.status_name}
          />
        </td>
        <td className="px-4 py-3">
          <AssigneeCell displayName={epic.assignee_display_name} />
        </td>
        <td className="px-4 py-3">
          <DueDateCell date={epic.due_date} isDone={isDone} />
        </td>
      </tr>
      {expanded
        ? kids.length === 0
          ? (
              <tr>
                <td
                  colSpan={4}
                  className="border-b border-border px-4 py-3 pl-12 text-sm italic text-text-muted"
                >
                  Esta épica aún no tiene historias.
                </td>
              </tr>
            )
          : kids.map((kid) => (
              <ChildRow
                key={kid.id}
                issue={kid}
                indented
                onSelect={onSelect}
              />
            ))
        : null}
    </>
  );
}

function OrphansSection({
  orphans,
  onSelect,
}: {
  orphans: IssueRow[];
  onSelect: (issue: IssueRow) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="border-b border-border bg-warm-50 px-4 pb-1 pt-6 text-xs font-medium uppercase tracking-wide text-text-muted"
        >
          Sin épica
        </td>
      </tr>
      {orphans.map((o) => (
        <ChildRow key={o.id} issue={o} indented={false} onSelect={onSelect} />
      ))}
    </>
  );
}

function ChildRow({
  issue,
  indented,
  onSelect,
}: {
  issue: IssueRow;
  indented: boolean;
  onSelect: (issue: IssueRow) => void;
}) {
  const isDone = issue.status_category === "Done";
  const meta = getIssueTypeMeta(issue.issue_type);
  return (
    <tr
      className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-warm-50"
      onClick={() => onSelect(issue)}
    >
      <td className={`px-4 py-2.5 ${indented ? "pl-12" : ""}`}>
        <div className="flex items-center gap-2">
          <meta.Icon
            className={`size-4 shrink-0 ${meta.colorClass}`}
            aria-hidden="true"
          />
          <span title={meta.label} className="sr-only">
            {meta.label}
          </span>
          <span className={`${GeistMono.className} text-xs text-text-muted`}>
            {issue.key}
          </span>
          <span className="text-text-primary">{issue.summary}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <StatusChip
          category={issue.status_category}
          statusName={issue.status_name}
        />
      </td>
      <td className="px-4 py-2.5">
        <AssigneeCell displayName={issue.assignee_display_name} />
      </td>
      <td className="px-4 py-2.5">
        <DueDateCell date={issue.due_date} isDone={isDone} />
      </td>
    </tr>
  );
}

function FilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <Card variant="compact" className="border border-dashed border-border bg-transparent text-center shadow-none">
      <p className="text-sm text-text-secondary">
        No hay issues que coincidan con los filtros actuales.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
      >
        Limpiar filtros
      </button>
    </Card>
  );
}

function NoIssuesEmpty() {
  return (
    <Card variant="compact" className="border border-dashed border-border bg-transparent text-center shadow-none">
      <p className="text-sm font-medium text-text-primary">
        Este proyecto no tiene issues sincronizadas todavía.
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        Volvé a /projects y usá &ldquo;Resincronizar&rdquo; para traer los
        datos de Jira.
      </p>
    </Card>
  );
}

function bucketize(rows: IssueRow[]): Buckets {
  const epics = rows.filter((r) => r.issue_type === "Epic");
  const epicIds = new Set(epics.map((e) => e.id));
  const childrenByEpic = new Map<string, IssueRow[]>();
  const orphans: IssueRow[] = [];
  for (const r of rows) {
    if (r.issue_type === "Epic") continue;
    if (r.parent_id && epicIds.has(r.parent_id)) {
      const list = childrenByEpic.get(r.parent_id) ?? [];
      list.push(r);
      childrenByEpic.set(r.parent_id, list);
    } else {
      // Story / Task / Bug whose parent is null OR is not an Epic
      // (e.g., Story under a Task — unusual but possible) goes here.
      orphans.push(r);
    }
  }
  return { epics, childrenByEpic, orphans };
}

function filterBuckets(
  buckets: Buckets,
  opts: { showOnlyActive: boolean; onlyWithDueDate: boolean },
): Buckets {
  const passes = (r: IssueRow) => {
    if (opts.showOnlyActive && r.status_category === "Done") return false;
    if (opts.onlyWithDueDate && !r.due_date) return false;
    return true;
  };
  const epics = buckets.epics.filter(passes);
  const childrenByEpic = new Map<string, IssueRow[]>();
  for (const epic of epics) {
    const kids = (buckets.childrenByEpic.get(epic.id) ?? []).filter(passes);
    childrenByEpic.set(epic.id, kids);
  }
  const orphans = buckets.orphans.filter(passes);
  return { epics, childrenByEpic, orphans };
}
