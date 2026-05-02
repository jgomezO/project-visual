"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button, Label, Popover, Switch, Tooltip } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const allPlanned = useMemo(
    () => buildPlannedEpics(rows, today, showCompleted),
    [rows, today, showCompleted],
  );
  const visible = useMemo(
    () => allPlanned.filter((e) => isInVisibleRange(e, range.from, range.to)),
    [allPlanned, range.from, range.to],
  );
  const outOfRange = useMemo(
    () => allPlanned.filter((e) => !isInVisibleRange(e, range.from, range.to)),
    [allPlanned, range.from, range.to],
  );

  const days = daysBetween(range.from, range.to);
  const chartWidth = Math.max(LEFT_COL_WIDTH, days * PX_PER_DAY);
  const showWeekTicks = days <= WEEK_TICKS_THRESHOLD_DAYS;
  const chartBodyHeight = Math.max(ROW_HEIGHT, ROW_HEIGHT * visible.length);

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

      <div className="flex overflow-hidden rounded-2xl border border-default-200">
        <div
          className="shrink-0 border-r border-default-200 bg-surface"
          style={{ width: LEFT_COL_WIDTH }}
        >
          <div
            className="border-b border-default-200 px-3 text-xs uppercase tracking-wide text-muted"
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
      </div>
    </div>
  );
}

function EpicLabel({ epic }: { epic: PlannedEpic }) {
  return (
    <div
      className="flex flex-col justify-center border-b border-default-100 px-3 last:border-b-0"
      style={{ height: ROW_HEIGHT }}
      title={epic.row.summary}
    >
      <span className="truncate text-sm font-medium">{epic.row.summary}</span>
      <span className="font-mono text-xs text-muted">{epic.row.key}</span>
    </div>
  );
}

const STATUS_BG: Record<EpicStatus, string> = {
  overdue: "bg-red-500",
  inProgress: "bg-blue-200",
  future: "bg-zinc-200",
  done: "bg-emerald-200",
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
        className={`absolute rounded-md text-left ring-offset-2 transition-shadow hover:ring-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400 ${STATUS_BG[epic.status]}`}
        style={{ left, top, width, height: BAR_HEIGHT }}
        aria-label={`${epic.row.key}: ${epic.row.summary}`}
      >
        {showProgress ? (
          <span
            className="pointer-events-none absolute inset-y-0 left-0 rounded-l-md bg-blue-600"
            style={{ width: progressWidth }}
            aria-hidden="true"
          />
        ) : null}
        {clippedLeft ? (
          <ChevronLeft
            className="pointer-events-none absolute -left-1 top-1/2 size-4 -translate-y-1/2 text-default-500"
            aria-hidden="true"
          />
        ) : null}
        {clippedRight ? (
          <ChevronRight
            className="pointer-events-none absolute -right-1 top-1/2 size-4 -translate-y-1/2 text-default-500"
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
        <span className="font-mono text-muted">{epic.row.key}</span>
        <StatusChip
          category={epic.row.status_category}
          statusName={epic.row.status_name}
        />
      </div>
      <p className="text-sm font-medium">{epic.row.summary}</p>
      <p className="text-muted">
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
        className="pointer-events-none absolute z-10 select-none rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-medium text-white shadow-sm"
        style={{
          left: x,
          top: 4,
          transform: "translateX(-50%)",
        }}
      >
        Hoy · {formatShortDate(today)}
      </span>
      <span
        className="pointer-events-none absolute bg-danger"
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

function OutOfRangeCounter({ epics }: { epics: PlannedEpic[] }) {
  return (
    <Popover>
      <Button size="sm" variant="tertiary">
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
                className="flex flex-col gap-0.5 rounded-md bg-default-50 px-2 py-1.5 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">
                    {e.row.key}
                  </span>
                  <span className="truncate">{e.row.summary}</span>
                </div>
                <span className="text-xs text-muted">
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
              variant={active ? undefined : "secondary"}
              isDisabled={range === null}
              onPress={() => range && onPick(range)}
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

      <Switch
        isSelected={showCompleted}
        onChange={onToggleCompleted}
        className="ml-auto"
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Content>
          <Label className="text-sm">Mostrar completadas</Label>
        </Switch.Content>
      </Switch>
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
        isDisabled={!isValid || !isDirty}
        onPress={() => onApply(draftFrom, draftTo)}
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
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        className="rounded-md border border-default-300 bg-surface px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default-400"
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
      className="relative border-b border-default-200"
      style={{ height: HEADER_HEIGHT }}
    >
      {labelTicks.map((tick) => {
        const x = dateToX(tick.date, from, to, chartWidth);
        return (
          <span
            key={tick.date.toISOString()}
            className="absolute top-0 select-none whitespace-nowrap pl-2 text-xs text-muted"
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
