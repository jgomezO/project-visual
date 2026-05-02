"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@heroui/react";
import {
  addDaysUTC,
  addMonthsUTC,
  daysBetween,
  dateToX,
  endOfMonthUTC,
  endOfQuarterUTC,
  formatMonthLabel,
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
const LEFT_COL_WIDTH = 240;
const HEADER_HEIGHT = 40;
const WEEK_TICKS_THRESHOLD_DAYS = 365;

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

  const days = daysBetween(range.from, range.to);
  const chartWidth = Math.max(LEFT_COL_WIDTH, days * PX_PER_DAY);
  const showWeekTicks = days <= WEEK_TICKS_THRESHOLD_DAYS;

  const { labelTicks, lineTicks } = useMemo(
    () => buildMonthTicks(range.from, range.to),
    [range.from, range.to],
  );
  const weekTicks = useMemo(
    () => (showWeekTicks ? buildWeekTicks(range.from, range.to) : []),
    [range.from, range.to, showWeekTicks],
  );

  return (
    <div className="space-y-4">
      <RangeControls
        rows={rows}
        currentFromIso={toISODate(range.from)}
        currentToIso={toISODate(range.to)}
        onPick={(next) => setRange(next)}
      />

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
          {/* Bars rows are added in a follow-up commit. */}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div className="relative" style={{ width: chartWidth }}>
            <TimelineHeader
              labelTicks={labelTicks}
              chartWidth={chartWidth}
              from={range.from}
              to={range.to}
            />
            <div
              className="relative"
              style={{ height: ROW_HEIGHT * 2 }}
              aria-hidden="true"
            >
              <GridLines
                weekTicks={weekTicks}
                lineTicks={lineTicks}
                chartWidth={chartWidth}
                height={ROW_HEIGHT * 2}
                from={range.from}
                to={range.to}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RangeControls({
  rows,
  currentFromIso,
  currentToIso,
  onPick,
}: {
  rows: IssueRow[];
  currentFromIso: string;
  currentToIso: string;
  onPick: (range: RoadmapRange | null) => void;
}) {
  const isPresetActive = (preset: PresetDef): boolean => {
    const r = preset.compute(rows);
    if (!r) return false;
    return (
      toISODate(r.from) === currentFromIso && toISODate(r.to) === currentToIso
    );
  };

  return (
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
