"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GeistMono } from "geist/font/mono";
import { Popover, Tooltip } from "@heroui/react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { Button, Card, Toggle } from "@/components/ui";
import { AssigneeCell } from "./AssigneeCell";
import { IssueDrawer } from "./IssueDrawer";
import { StatusChip } from "./StatusChip";
import {
  addDaysUTC,
  addMonthsUTC,
  daysBetween,
  dateToX,
  endOfMonthUTC,
  endOfQuarterUTC,
  formatMonthLabel,
  formatShortDate,
  isValidISODate,
  parseISODate,
  startOfMonthUTC,
  startOfQuarterUTC,
  startOfWeekUTC,
  todayUTC,
  toISODate,
} from "@/lib/format/roadmapDates";
import type { IssueRow } from "./ProjectTable";

const PX_PER_DAY = 8;
const ROW_HEIGHT = 48;
const BAR_HEIGHT = 28;
const LEFT_COL_WIDTH = 240;
const HEADER_HEIGHT = 40;
const WEEK_TICKS_THRESHOLD_DAYS = 365;

type EpicStatus = "overdue" | "inProgress" | "future" | "done";

interface PlannedEpic {
  row: IssueRow;
  start: Date;
  due: Date;
  status: EpicStatus;
}

const STATUS_ORDER: Record<EpicStatus, number> = {
  overdue: 0,
  inProgress: 1,
  future: 2,
  done: 3,
};

function classifyEpic(start: Date, due: Date, statusCategory: string, today: Date): EpicStatus {
  if (statusCategory === "Done") return "done";
  if (due.getTime() < today.getTime()) return "overdue";
  if (start.getTime() > today.getTime()) return "future";
  return "inProgress";
}

function buildPlannedEpics(
  rows: IssueRow[],
  today: Date,
  showCompleted: boolean,
): PlannedEpic[] {
  const list: PlannedEpic[] = [];
  for (const r of rows) {
    if (r.issue_type !== "Epic") continue;
    if (!r.start_date || !r.due_date) continue;
    const start = parseISODate(r.start_date);
    const due = parseISODate(r.due_date);
    const status = classifyEpic(start, due, r.status_category, today);
    if (status === "done" && !showCompleted) continue;
    list.push({ row: r, start, due, status });
  }
  list.sort((a, b) => {
    const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (so !== 0) return so;
    return a.due.getTime() - b.due.getTime();
  });
  return list;
}

function isInVisibleRange(epic: PlannedEpic, from: Date, to: Date): boolean {
  return (
    epic.due.getTime() >= from.getTime() &&
    epic.start.getTime() <= to.getTime()
  );
}

interface RoadmapRange {
  from: Date;
  to: Date;
}

function defaultRange(): RoadmapRange {
  const today = todayUTC();
  return { from: today, to: addMonthsUTC(today, 6) };
}

function parseRangeFromParams(
  searchParams: URLSearchParams,
): RoadmapRange {
  const fromRaw = searchParams.get("from") ?? undefined;
  const toRaw = searchParams.get("to") ?? undefined;
  if (!isValidISODate(fromRaw) || !isValidISODate(toRaw)) {
    return defaultRange();
  }
  const from = parseISODate(fromRaw);
  const to = parseISODate(toRaw);
  if (from.getTime() >= to.getTime()) return defaultRange();
  return { from, to };
}

interface PresetDef {
  id: string;
  label: string;
  compute: (rows: IssueRow[]) => RoadmapRange | null;
}

const PRESETS: PresetDef[] = [
  {
    id: "quarter",
    label: "Este trimestre",
    compute: () => {
      const today = todayUTC();
      return { from: startOfQuarterUTC(today), to: endOfQuarterUTC(today) };
    },
  },
  {
    id: "6m",
    label: "Próximos 6 meses",
    compute: () => defaultRange(),
  },
  {
    id: "1y",
    label: "Próximo año",
    compute: () => {
      const today = todayUTC();
      return { from: today, to: addMonthsUTC(today, 12) };
    },
  },
  {
    id: "all",
    label: "Todo",
    compute: (rows) => {
      const epics = rows.filter((r) => r.issue_type === "Epic");
      const dates: Date[] = [];
      for (const e of epics) {
        if (e.start_date) dates.push(parseISODate(e.start_date));
        if (e.due_date) dates.push(parseISODate(e.due_date));
      }
      if (dates.length === 0) return null;
      const min = new Date(Math.min(...dates.map((d) => d.getTime())));
      const max = new Date(Math.max(...dates.map((d) => d.getTime())));
      return {
        from: startOfMonthUTC(addMonthsUTC(min, -1)),
        to: endOfMonthUTC(addMonthsUTC(max, 1)),
      };
    },
  },
];

export function ProjectRoadmap({ rows }: { rows: IssueRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedIssue, setSelectedIssue] = useState<IssueRow | null>(null);
  // showCompleted is intentionally NOT persisted in the URL — feedback was
  // explicit about keeping shareable links stable to the planned-work view.
  const [showCompleted, setShowCompleted] = useState(false);

  const range = useMemo(
    () => parseRangeFromParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setRange = (next: RoadmapRange | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === null) {
      params.delete("from");
      params.delete("to");
    } else {
      params.set("from", toISODate(next.from));
      params.set("to", toISODate(next.to));
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const today = todayUTC();
  const allEpics = useMemo(
    () => rows.filter((r) => r.issue_type === "Epic"),
    [rows],
  );
  const allPlanned = useMemo(
    () => buildPlannedEpics(rows, today, showCompleted),
    [rows, today, showCompleted],
  );
  const unplannedCount = useMemo(
    () => buildUnplanned(rows).length,
    [rows],
  );
  const visible = useMemo(
    () => allPlanned.filter((e) => isInVisibleRange(e, range.from, range.to)),
    [allPlanned, range.from, range.to],
  );
  const outOfRange = useMemo(
    () => allPlanned.filter((e) => !isInVisibleRange(e, range.from, range.to)),
    [allPlanned, range.from, range.to],
  );

  if (allEpics.length === 0) {
    return <NoEpicsEmpty />;
  }

  const days = daysBetween(range.from, range.to);
  const chartWidth = Math.max(LEFT_COL_WIDTH, days * PX_PER_DAY);
  const showWeekTicks = days <= WEEK_TICKS_THRESHOLD_DAYS;
  const isEmptyChart = visible.length === 0;
  // The empty-state slot sits where bars would otherwise go; give it a
  // floor height so it reads as a proper message panel, not a sliver.
  const chartBodyHeight = isEmptyChart
    ? ROW_HEIGHT * 3
    : ROW_HEIGHT * visible.length;
  const noneArePlanned = allPlanned.length === 0;
  const allPreset = PRESETS.find((p) => p.id === "all");
  const allPresetRange = allPreset?.compute(rows) ?? null;

  const { labelTicks, lineTicks } = useMemo(
    () => buildMonthTicks(range.from, range.to),
    [range.from, range.to],
  );
  const weekTicks = useMemo(
    () => (showWeekTicks ? buildWeekTicks(range.from, range.to) : []),
    [range.from, range.to, showWeekTicks],
  );

  const todayX = dateToX(today, range.from, range.to, chartWidth);
  const todayInRange =
    today.getTime() >= range.from.getTime() &&
    today.getTime() <= range.to.getTime();

  return (
    <div className="space-y-4">
      <IssueDrawer
        issue={selectedIssue}
        onClose={() => setSelectedIssue(null)}
      />

      <RangeControls
        rows={rows}
        currentFromIso={toISODate(range.from)}
        currentToIso={toISODate(range.to)}
        onPick={(next) => setRange(next)}
        showCompleted={showCompleted}
        onToggleCompleted={setShowCompleted}
      />

      {outOfRange.length > 0 ? (
        <OutOfRangeCounter epics={outOfRange} />
      ) : null}

      <Card className="flex overflow-hidden p-0">
        <div
          className="shrink-0 border-r border-border bg-surface"
          style={{ width: LEFT_COL_WIDTH }}
        >
          <div
            className="border-b border-border px-3 text-xs font-medium uppercase tracking-wide text-text-muted"
            style={{
              height: HEADER_HEIGHT,
              lineHeight: `${HEADER_HEIGHT}px`,
            }}
          >
            Épica
          </div>
          {visible.map((epic) => (
            <EpicLabel key={epic.row.id} epic={epic} />
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="relative" style={{ width: chartWidth }}>
            <TimelineHeader
              labelTicks={labelTicks}
              chartWidth={chartWidth}
              from={range.from}
              to={range.to}
            />
            <div className="relative" style={{ height: chartBodyHeight }}>
              <GridLines
                weekTicks={weekTicks}
                lineTicks={lineTicks}
                chartWidth={chartWidth}
                height={chartBodyHeight}
                from={range.from}
                to={range.to}
              />
              {visible.map((epic, idx) => (
                <EpicBar
                  key={epic.row.id}
                  epic={epic}
                  rowIndex={idx}
                  chartWidth={chartWidth}
                  from={range.from}
                  to={range.to}
                  today={today}
                  onSelect={() => setSelectedIssue(epic.row)}
                />
              ))}
              {isEmptyChart ? (
                <ChartEmptyOverlay
                  variant={noneArePlanned ? "no-planned" : "none-in-range"}
                  unplannedCount={unplannedCount}
                  onPickAll={
                    allPresetRange ? () => setRange(allPresetRange) : null
                  }
                />
              ) : null}
            </div>
            {todayInRange ? (
              <TodayLine
                x={todayX}
                bodyHeight={chartBodyHeight}
                today={today}
              />
            ) : null}
          </div>
        </div>
      </Card>

      <UnplannedSection
        rows={rows}
        onSelect={(issue) => setSelectedIssue(issue)}
      />
    </div>
  );
}

function EpicLabel({ epic }: { epic: PlannedEpic }) {
  return (
    <div
      className="flex flex-col justify-center border-b border-border px-3 last:border-b-0"
      style={{ height: ROW_HEIGHT }}
      title={epic.row.summary}
    >
      <span className="truncate text-sm font-medium text-text-primary">
        {epic.row.summary}
      </span>
      <span className={`${GeistMono.className} text-xs text-text-muted`}>
        {epic.row.key}
      </span>
    </div>
  );
}

// Functional palette for the timeline bars (iter 4h R2). Each bucket
// reads as its own status — overdue is the only saturated value
// (deliberately loud), the rest are the suave -bg pairs of the Prism
// functional ramp so they don't fight the saturated In Progress
// overlay (bg-info) or the saturated Today line (bg-error).
const STATUS_BG: Record<EpicStatus, string> = {
  overdue: "bg-error",
  inProgress: "bg-info-bg",
  future: "bg-cool-200",
  done: "bg-success-bg",
};

const STATUS_LABEL: Record<EpicStatus, string> = {
  overdue: "Atrasada",
  inProgress: "En curso",
  future: "Próxima",
  done: "Completada",
};

function EpicBar({
  epic,
  rowIndex,
  chartWidth,
  from,
  to,
  today,
  onSelect,
}: {
  epic: PlannedEpic;
  rowIndex: number;
  chartWidth: number;
  from: Date;
  to: Date;
  today: Date;
  onSelect: () => void;
}) {
  const x1 = dateToX(epic.start, from, to, chartWidth);
  const x2 = dateToX(epic.due, from, to, chartWidth);
  const left = Math.max(0, x1);
  const right = Math.min(chartWidth, x2);
  const width = Math.max(2, right - left);
  const clippedLeft = x1 < 0;
  const clippedRight = x2 > chartWidth;
  const top = rowIndex * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;

  const todayX = dateToX(today, from, to, chartWidth);
  const showProgress =
    epic.status === "inProgress" && todayX > left && todayX < right;
  const progressWidth = showProgress ? todayX - left : 0;

  return (
    <Tooltip delay={150}>
      <button
        type="button"
        onClick={onSelect}
        className={`absolute rounded-md text-left ring-offset-2 transition-shadow hover:ring-2 hover:ring-primary-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${STATUS_BG[epic.status]}`}
        style={{ left, top, width, height: BAR_HEIGHT }}
        aria-label={`${epic.row.key}: ${epic.row.summary}`}
      >
        {showProgress ? (
          <span
            className="pointer-events-none absolute inset-y-0 left-0 rounded-l-md bg-info"
            style={{ width: progressWidth }}
            aria-hidden="true"
          />
        ) : null}
        {clippedLeft ? (
          <ChevronLeft
            className="pointer-events-none absolute -left-1 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
        ) : null}
        {clippedRight ? (
          <ChevronRight
            className="pointer-events-none absolute -right-1 top-1/2 size-4 -translate-y-1/2 text-text-secondary"
            aria-hidden="true"
          />
        ) : null}
      </button>
      <Tooltip.Content className="max-w-xs">
        <BarTooltipBody epic={epic} />
      </Tooltip.Content>
    </Tooltip>
  );
}

function BarTooltipBody({ epic }: { epic: PlannedEpic }) {
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-center gap-2">
        <span className={`${GeistMono.className} text-text-muted`}>
          {epic.row.key}
        </span>
        <StatusChip
          category={epic.row.status_category}
          statusName={epic.row.status_name}
        />
      </div>
      <p className="text-sm font-medium text-text-primary">
        {epic.row.summary}
      </p>
      <p className="text-text-muted">
        {STATUS_LABEL[epic.status]} · {formatShortDate(epic.start)} →{" "}
        {formatShortDate(epic.due)}
      </p>
      <AssigneeCell displayName={epic.row.assignee_display_name} />
    </div>
  );
}

function TodayLine({
  x,
  bodyHeight,
  today,
}: {
  x: number;
  bodyHeight: number;
  today: Date;
}) {
  const totalHeight = HEADER_HEIGHT + bodyHeight;
  return (
    <>
      <span
        className="pointer-events-none absolute z-10 select-none rounded-md bg-error px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
        style={{
          left: x,
          top: 4,
          transform: "translateX(-50%)",
        }}
      >
        Hoy · {formatShortDate(today)}
      </span>
      <span
        className="pointer-events-none absolute bg-error"
        style={{
          left: x,
          top: 0,
          width: 1,
          height: totalHeight,
        }}
        aria-hidden="true"
      />
    </>
  );
}

function NoEpicsEmpty() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="text-sm font-medium text-text-primary">
        Este proyecto no tiene épicas todavía.
      </p>
      <p className="mt-1 text-sm text-text-secondary">
        Cuando se sincronice una épica desde Jira aparecerá acá.
      </p>
    </div>
  );
}

function ChartEmptyOverlay({
  variant,
  unplannedCount,
  onPickAll,
}: {
  variant: "no-planned" | "none-in-range";
  unplannedCount: number;
  onPickAll: (() => void) | null;
}) {
  if (variant === "no-planned") {
    const message =
      unplannedCount > 0
        ? "No hay épicas planificadas. Las que están sin fechas aparecen abajo."
        : "Sin épicas planificadas en este momento.";
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
        <p className="max-w-sm text-sm text-text-secondary">{message}</p>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="max-w-sm text-sm text-text-secondary">
        No hay épicas en este rango. Probá ajustar las fechas o ver
        &ldquo;Todo&rdquo;.
      </p>
      {onPickAll ? (
        <Button size="sm" variant="secondary" onClick={onPickAll}>
          Ver todo
        </Button>
      ) : null}
    </div>
  );
}

type Missing = "start" | "due" | "both";

interface UnplannedEpic {
  row: IssueRow;
  missing: Missing;
}

const STATUS_SORT: Record<string, number> = {
  "In Progress": 0,
  "To Do": 1,
  Done: 2,
};

function buildUnplanned(rows: IssueRow[]): UnplannedEpic[] {
  const list: UnplannedEpic[] = [];
  for (const r of rows) {
    if (r.issue_type !== "Epic") continue;
    if (r.status_category === "Done") continue;
    if (r.start_date && r.due_date) continue;
    let missing: Missing;
    if (!r.start_date && !r.due_date) missing = "both";
    else if (!r.start_date) missing = "start";
    else missing = "due";
    list.push({ row: r, missing });
  }
  list.sort((a, b) => {
    const sa = STATUS_SORT[a.row.status_category] ?? 3;
    const sb = STATUS_SORT[b.row.status_category] ?? 3;
    if (sa !== sb) return sa - sb;
    const ta = a.row.updated_at_jira
      ? new Date(a.row.updated_at_jira).getTime()
      : 0;
    const tb = b.row.updated_at_jira
      ? new Date(b.row.updated_at_jira).getTime()
      : 0;
    return tb - ta;
  });
  return list;
}

const MISSING_LABEL: Record<Missing, string> = {
  start: "Falta start date",
  due: "Falta due date",
  both: "Sin fechas",
};

function jiraBrowseUrl(key: string): string | null {
  const base = process.env.NEXT_PUBLIC_JIRA_BASE_URL?.replace(/\/$/, "");
  return base ? `${base}/browse/${key}` : null;
}

function UnplannedSection({
  rows,
  onSelect,
}: {
  rows: IssueRow[];
  onSelect: (issue: IssueRow) => void;
}) {
  const unplanned = useMemo(() => buildUnplanned(rows), [rows]);
  if (unplanned.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 border-t border-border pt-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Sin planificar ({unplanned.length}{" "}
          {unplanned.length === 1 ? "épica" : "épicas"})
        </h2>
      </div>
      <ul className="flex flex-col gap-2">
        {unplanned.map((u) => (
          <UnplannedCard
            key={u.row.id}
            unplanned={u}
            onSelect={() => onSelect(u.row)}
          />
        ))}
      </ul>
    </section>
  );
}

function UnplannedCard({
  unplanned,
  onSelect,
}: {
  unplanned: UnplannedEpic;
  onSelect: () => void;
}) {
  const { row, missing } = unplanned;
  const jiraUrl = jiraBrowseUrl(row.key);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full flex-col gap-2 rounded-2xl bg-surface px-4 py-3 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <div className="flex min-w-0 items-center gap-2 pr-32">
          <span className={`${GeistMono.className} text-xs text-text-muted`}>
            {row.key}
          </span>
          <span className="truncate text-sm font-medium text-text-primary">
            {row.summary}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip
            category={row.status_category}
            statusName={row.status_name}
          />
          <AssigneeCell displayName={row.assignee_display_name} />
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning">
            <AlertTriangle className="size-3" aria-hidden="true" />
            {MISSING_LABEL[missing]}
          </span>
        </div>
      </button>
      {jiraUrl ? (
        <a
          href={jiraUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-text-primary px-2.5 py-1 text-xs font-medium text-surface hover:opacity-90"
        >
          Editar en Jira
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      ) : null}
    </li>
  );
}

function OutOfRangeCounter({ epics }: { epics: PlannedEpic[] }) {
  return (
    <Popover>
      <Button size="sm" variant="ghost">
        {epics.length}{" "}
        {epics.length === 1
          ? "épica fuera del rango actual"
          : "épicas fuera del rango actual"}
      </Button>
      <Popover.Content className="max-w-md">
        <Popover.Dialog>
          <Popover.Heading>Fuera del rango actual</Popover.Heading>
          <ul className="mt-2 flex max-h-80 flex-col gap-1.5 overflow-y-auto">
            {epics.map((e) => (
              <li
                key={e.row.id}
                className="flex flex-col gap-0.5 rounded-md bg-warm-50 px-2 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`${GeistMono.className} text-xs text-text-muted`}
                  >
                    {e.row.key}
                  </span>
                  <span className="truncate text-text-primary">
                    {e.row.summary}
                  </span>
                </div>
                <span className="text-xs text-text-muted">
                  {formatShortDate(e.start)} → {formatShortDate(e.due)}
                </span>
              </li>
            ))}
          </ul>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function RangeControls({
  rows,
  currentFromIso,
  currentToIso,
  onPick,
  showCompleted,
  onToggleCompleted,
}: {
  rows: IssueRow[];
  currentFromIso: string;
  currentToIso: string;
  onPick: (range: RoadmapRange | null) => void;
  showCompleted: boolean;
  onToggleCompleted: (next: boolean) => void;
}) {
  const isPresetActive = (preset: PresetDef): boolean => {
    const r = preset.compute(rows);
    if (!r) return false;
    return (
      toISODate(r.from) === currentFromIso && toISODate(r.to) === currentToIso
    );
  };

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => {
          const range = p.compute(rows);
          const active = isPresetActive(p);
          return (
            <Button
              key={p.id}
              size="sm"
              variant={active ? "primary" : "secondary"}
              disabled={range === null}
              onClick={() => range && onPick(range)}
            >
              {p.label}
            </Button>
          );
        })}
      </div>

      <ManualRangeInputs
        key={`${currentFromIso}-${currentToIso}`}
        currentFromIso={currentFromIso}
        currentToIso={currentToIso}
        onApply={(from, to) =>
          onPick({ from: parseISODate(from), to: parseISODate(to) })
        }
      />

      <Toggle
        checked={showCompleted}
        onChange={onToggleCompleted}
        label="Mostrar completadas"
        className="ml-auto"
      />
    </div>
  );
}

function ManualRangeInputs({
  currentFromIso,
  currentToIso,
  onApply,
}: {
  currentFromIso: string;
  currentToIso: string;
  onApply: (from: string, to: string) => void;
}) {
  // Parent re-keys this component whenever the URL range changes, so the
  // useState initializers are guaranteed to match the latest URL on mount.
  const [draftFrom, setDraftFrom] = useState(currentFromIso);
  const [draftTo, setDraftTo] = useState(currentToIso);

  const isValid =
    isValidISODate(draftFrom) &&
    isValidISODate(draftTo) &&
    parseISODate(draftFrom).getTime() < parseISODate(draftTo).getTime();
  const isDirty = draftFrom !== currentFromIso || draftTo !== currentToIso;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <DateInput
        label="Desde"
        value={draftFrom}
        onChange={setDraftFrom}
      />
      <DateInput label="Hasta" value={draftTo} onChange={setDraftTo} />
      <Button
        size="sm"
        variant="secondary"
        disabled={!isValid || !isDirty}
        onClick={() => onApply(draftFrom, draftTo)}
      >
        Aplicar
      </Button>
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  // Native <input type="date"> until a HeroUI v3 DatePicker with confirmed
  // es-AR locale support lands. The browser-native picker is locale-aware
  // and accessible — no React-side i18n risk.
  return (
    <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wide text-text-muted">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      />
    </label>
  );
}

interface MonthTick {
  // x is computed from this date.
  date: Date;
  label: string;
}

interface WeekTick {
  date: Date;
}

// Two separate tick streams:
//  - labelTicks: positioned where the label should appear in the header.
//    The first one is anchored at `from` so a partial-month range still
//    shows its starting month at x=0 instead of skipping it.
//  - lineTicks: vertical month-boundary lines on the grid. Drawn only at
//    actual month boundaries (1st of each month) inside the range.
function buildMonthTicks(
  from: Date,
  to: Date,
): { labelTicks: MonthTick[]; lineTicks: MonthTick[] } {
  const labelTicks: MonthTick[] = [];
  const lineTicks: MonthTick[] = [];

  const fromMonthStart = startOfMonthUTC(from);
  const isPartialFirstMonth = fromMonthStart.getTime() < from.getTime();

  if (isPartialFirstMonth) {
    labelTicks.push({ date: from, label: formatMonthLabel(fromMonthStart) });
  }

  let cursor = isPartialFirstMonth
    ? startOfMonthUTC(addMonthsUTC(from, 1))
    : fromMonthStart;
  while (cursor.getTime() <= to.getTime()) {
    const label = formatMonthLabel(cursor);
    labelTicks.push({ date: cursor, label });
    lineTicks.push({ date: cursor, label });
    cursor = addMonthsUTC(cursor, 1);
  }

  return { labelTicks, lineTicks };
}

function buildWeekTicks(from: Date, to: Date): WeekTick[] {
  const ticks: WeekTick[] = [];
  let cursor = startOfWeekUTC(from);
  if (cursor.getTime() < from.getTime()) cursor = addDaysUTC(cursor, 7);
  while (cursor.getTime() <= to.getTime()) {
    ticks.push({ date: cursor });
    cursor = addDaysUTC(cursor, 7);
  }
  return ticks;
}

function TimelineHeader({
  labelTicks,
  chartWidth,
  from,
  to,
}: {
  labelTicks: MonthTick[];
  chartWidth: number;
  from: Date;
  to: Date;
}) {
  return (
    <div
      className="relative border-b border-border"
      style={{ height: HEADER_HEIGHT }}
    >
      {labelTicks.map((tick) => {
        const x = dateToX(tick.date, from, to, chartWidth);
        return (
          <span
            key={tick.date.toISOString()}
            className="absolute top-0 select-none whitespace-nowrap pl-2 text-xs font-medium text-text-muted"
            style={{
              left: x,
              height: HEADER_HEIGHT,
              lineHeight: `${HEADER_HEIGHT}px`,
            }}
          >
            {tick.label}
          </span>
        );
      })}
    </div>
  );
}

function GridLines({
  weekTicks,
  lineTicks,
  chartWidth,
  height,
  from,
  to,
}: {
  weekTicks: WeekTick[];
  lineTicks: MonthTick[];
  chartWidth: number;
  height: number;
  from: Date;
  to: Date;
}) {
  return (
    <svg
      className="absolute inset-0"
      width={chartWidth}
      height={height}
      role="presentation"
    >
      {weekTicks.map((tick) => {
        const x = dateToX(tick.date, from, to, chartWidth);
        return (
          <line
            key={`w-${tick.date.toISOString()}`}
            x1={x}
            x2={x}
            y1={0}
            y2={height}
            className="stroke-default-100"
            strokeWidth={1}
          />
        );
      })}
      {lineTicks.map((tick) => {
        const x = dateToX(tick.date, from, to, chartWidth);
        return (
          <line
            key={`m-${tick.date.toISOString()}`}
            x1={x}
            x2={x}
            y1={0}
            y2={height}
            className="stroke-default-200"
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
