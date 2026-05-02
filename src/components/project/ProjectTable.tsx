"use client";

import { useMemo, useState } from "react";
import { Label, Switch } from "@heroui/react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { AssigneeCell } from "./AssigneeCell";
import { DueDateCell } from "./DueDateCell";
import { IssueDrawer } from "./IssueDrawer";
import { StatusChip } from "./StatusChip";

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
}

interface Buckets {
  epics: IssueRow[];
  childrenByEpic: Map<string, IssueRow[]>;
  orphans: IssueRow[];
}

export function ProjectTable({ rows }: { rows: IssueRow[] }) {
  const [showOnlyActive, setShowOnlyActive] = useState(true);
  const [onlyWithDueDate, setOnlyWithDueDate] = useState(false);
  // Map keyed by epic id; absent = use defaultExpanded for that epic.
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
    <div className="space-y-4">
      <IssueDrawer
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />
      <div className="flex flex-wrap items-center gap-6">
        <ToggleSwitch
          checked={showOnlyActive}
          onChange={setShowOnlyActive}
          label="Solo activas"
        />
        <ToggleSwitch
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="pb-2 pl-2">Summary</th>
                <th className="pb-2 w-32">Status</th>
                <th className="pb-2 w-56">Asignado</th>
                <th className="pb-2 w-28 pr-2">Vence</th>
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
      )}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <Switch isSelected={checked} onChange={onChange}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <Switch.Content>
        <Label className="text-sm">{label}</Label>
      </Switch.Content>
    </Switch>
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

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-default-100"
        onClick={() => onSelect(epic)}
      >
        <td className="py-2 pl-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={expanded ? "Colapsar épica" : "Expandir épica"}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="rounded p-0.5 hover:bg-default-200"
            >
              <Chevron className="size-4" />
            </button>
            <span className="font-mono text-xs text-muted">{epic.key}</span>
            <span className="font-medium">{epic.summary}</span>
            {isDone ? (
              <CheckCircle2
                className="size-4 text-emerald-600"
                aria-label="Épica completada"
              />
            ) : null}
            {showEmptyEpicBadge ? (
              <span className="rounded-full bg-default-100 px-2 py-0.5 text-xs text-muted">
                Sin historias
              </span>
            ) : null}
          </div>
        </td>
        <td>
          <StatusChip
            category={epic.status_category}
            statusName={epic.status_name}
          />
        </td>
        <td>
          <AssigneeCell displayName={epic.assignee_display_name} />
        </td>
        <td className="pr-2">
          <DueDateCell date={epic.due_date} isDone={isDone} />
        </td>
      </tr>
      {expanded
        ? kids.length === 0
          ? (
              <tr>
                <td
                  colSpan={4}
                  className="py-2 pl-12 text-sm italic text-muted"
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
          className="pt-6 pb-1 pl-2 text-xs uppercase tracking-wide text-muted"
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
  return (
    <tr
      className="cursor-pointer hover:bg-default-100"
      onClick={() => onSelect(issue)}
    >
      <td className={`py-1.5 ${indented ? "pl-12" : "pl-2"}`}>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">{issue.key}</span>
          <span>{issue.summary}</span>
        </div>
      </td>
      <td>
        <StatusChip
          category={issue.status_category}
          statusName={issue.status_name}
        />
      </td>
      <td>
        <AssigneeCell displayName={issue.assignee_display_name} />
      </td>
      <td className="pr-2">
        <DueDateCell date={issue.due_date} isDone={isDone} />
      </td>
    </tr>
  );
}

function FilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-default-300 p-8 text-center">
      <p className="text-sm text-muted">
        No hay issues que coincidan con los filtros actuales.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 text-sm underline"
      >
        Limpiar filtros
      </button>
    </div>
  );
}

function NoIssuesEmpty() {
  return (
    <div className="rounded-2xl border border-dashed border-default-300 p-10 text-center">
      <p className="text-sm font-medium">
        Este proyecto no tiene issues sincronizadas todavía.
      </p>
      <p className="mt-1 text-sm text-muted">
        Volvé a /projects y usá &ldquo;Resincronizar&rdquo; para traer los
        datos de Jira.
      </p>
    </div>
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
