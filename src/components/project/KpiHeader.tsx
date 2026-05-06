import Link from "next/link";
import { Card } from "@heroui/react";
import { AlertTriangle, Ban, CheckCircle2 } from "lucide-react";
import { relativeFromNow } from "@/lib/format/relativeTime";

export interface DashboardData {
  project_id: string | null;
  project_key: string | null;
  project_name: string | null;
  lead_display_name: string | null;
  last_synced_at: string | null;
  total: number | null;
  todo_count: number | null;
  in_progress_count: number | null;
  done_count: number | null;
  overdue_count: number | null;
  blocked_count: number | null;
}

export function KpiHeader({ data }: { data: DashboardData }) {
  const total = data.total ?? 0;
  const todo = data.todo_count ?? 0;
  const inProgress = data.in_progress_count ?? 0;
  const done = data.done_count ?? 0;
  const overdue = data.overdue_count ?? 0;
  const blocked = data.blocked_count ?? 0;
  const donePct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <header className="space-y-6">
      <Breadcrumb
        projectName={data.project_name ?? data.project_key ?? "—"}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">
            {data.project_name ?? "Proyecto sin nombre"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono">{data.project_key}</span>
            {data.lead_display_name ? ` · Lead: ${data.lead_display_name}` : ""}
            {data.last_synced_at
              ? ` · Última sync: ${relativeFromNow(data.last_synced_at)}`
              : " · Sin sincronizar"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalCard
          total={total}
          todo={todo}
          inProgress={inProgress}
          done={done}
        />
        <CompletedCard pct={donePct} />
        <OverdueCard count={overdue} />
        <BlockedCard count={blocked} />
      </div>
    </header>
  );
}

function Breadcrumb({ projectName }: { projectName: string }) {
  return (
    <nav className="flex items-center gap-2 text-sm text-muted">
      <Link href="/projects" className="hover:underline">
        Proyectos
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-foreground">{projectName}</span>
    </nav>
  );
}

function TotalCard({
  total,
  todo,
  inProgress,
  done,
}: {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
}) {
  const tooltip = `${todo} To Do · ${inProgress} In Progress · ${done} Done`;
  const todoPct = total === 0 ? 0 : (todo / total) * 100;
  const inProgressPct = total === 0 ? 0 : (inProgress / total) * 100;
  const donePct = total === 0 ? 0 : (done / total) * 100;

  return (
    <Card>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-muted">Total de issues</p>
          <p className="text-3xl font-semibold tabular-nums">{total}</p>
        </div>
        {total > 0 ? (
          <>
            <div
              title={tooltip}
              className="flex h-2 w-full overflow-hidden rounded-full"
              role="img"
              aria-label={tooltip}
            >
              <div className="bg-zinc-300" style={{ width: `${todoPct}%` }} />
              <div
                className="bg-blue-500"
                style={{ width: `${inProgressPct}%` }}
              />
              <div
                className="bg-emerald-500"
                style={{ width: `${donePct}%` }}
              />
            </div>
            <p className="text-xs text-muted">{tooltip}</p>
          </>
        ) : (
          <p className="text-xs text-muted">Sin issues sincronizadas</p>
        )}
      </div>
    </Card>
  );
}

function CompletedCard({ pct }: { pct: number }) {
  let colorClass = "text-emerald-600";
  if (pct < 30) colorClass = "text-danger";
  else if (pct < 70) colorClass = "text-amber-600";
  return (
    <Card>
      <div>
        <p className="text-xs text-muted">% completado</p>
        <p className={`text-3xl font-semibold tabular-nums ${colorClass}`}>
          {pct}%
        </p>
      </div>
    </Card>
  );
}

function OverdueCard({ count }: { count: number }) {
  const safe = count === 0;
  return (
    <Card>
      <div>
        <p className="text-xs text-muted">Issues vencidas</p>
        <p
          className={`flex items-center gap-2 text-3xl font-semibold tabular-nums ${
            safe ? "text-emerald-600" : "text-danger"
          }`}
        >
          {safe ? (
            <CheckCircle2 className="size-7" />
          ) : (
            <AlertTriangle className="size-7" />
          )}
          {count}
        </p>
      </div>
    </Card>
  );
}

function BlockedCard({ count }: { count: number }) {
  const safe = count === 0;
  return (
    <Card>
      <div>
        <p className="text-xs text-muted">Issues bloqueadas</p>
        <p
          className={`flex items-center gap-2 text-3xl font-semibold tabular-nums ${
            safe ? "text-emerald-600" : "text-danger"
          }`}
        >
          {safe ? (
            <CheckCircle2 className="size-7" />
          ) : (
            <Ban className="size-7" />
          )}
          {count}
        </p>
      </div>
    </Card>
  );
}
