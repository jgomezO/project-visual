import { notFound } from "next/navigation";
import { NarrativesListPanel } from "@/components/narrative-list/NarrativesListPanel";
import { KpiHeader, type DashboardData } from "@/components/project/KpiHeader";
import {
  type IssueRow,
  type StatusCategory,
} from "@/components/project/ProjectTable";
import { ProjectViews, type ViewKey } from "@/components/project/ProjectViews";
import { getAnonSupabase } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function parseView(raw: string | string[] | undefined): ViewKey {
  if (raw === "roadmap") return "roadmap";
  if (raw === "narratives") return "narratives";
  return "list";
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: PageProps) {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  const view = parseView(sp.view);

  const supabase = getAnonSupabase();

  const { data: rows, error: rpcError } = await supabase.rpc(
    "project_dashboard",
    { p_project_key: key },
  );
  if (rpcError) throw rpcError;
  const dashboard = (rows?.[0] ?? null) as DashboardData | null;
  if (!dashboard || !dashboard.project_id) {
    notFound();
  }

  const { data: issueRows, error: issuesError } = await supabase
    .from("issues")
    .select(
      "id, key, summary, issue_type, status_name, status_category, assignee_account_id, assignee_display_name, priority, parent_id, due_date, start_date, updated_at_jira",
    )
    .eq("project_id", dashboard.project_id)
    .not("issue_type", "ilike", "%Sub-task%")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("key", { ascending: true });
  if (issuesError) throw issuesError;

  // The status_category CHECK constraint guarantees these values; the
  // generated type is `string`, so we narrow on the boundary.
  const tableRows: IssueRow[] = (issueRows ?? []).map((r) => ({
    ...r,
    status_category: r.status_category as StatusCategory,
  }));

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
      <KpiHeader data={dashboard} />
      <ProjectViews
        rows={tableRows}
        view={view}
        narrativesPanel={
          <NarrativesListPanel
            projectKey={key}
            projectId={dashboard.project_id}
            projectName={null}
          />
        }
      />
    </main>
  );
}
