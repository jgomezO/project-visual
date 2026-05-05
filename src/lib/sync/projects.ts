import "server-only";
import type { JiraClient } from "@/lib/jira/client";
import { getServerSupabaseAdmin } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";

export interface SyncProjectsResult {
  projectKeys: string[];
}

export async function syncProjects(
  jira: JiraClient,
): Promise<SyncProjectsResult> {
  const supabase = getServerSupabaseAdmin();
  const projects = await jira.listProjects();

  if (projects.length === 0) {
    return { projectKeys: [] };
  }

  const rows = projects.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    lead_account_id: p.lead?.accountId ?? null,
    lead_display_name: p.lead?.displayName ?? null,
    raw: p as unknown as Json,
  }));

  const { error } = await supabase
    .from("projects")
    .upsert(rows, { onConflict: "id" });
  if (error) throw error;

  return { projectKeys: projects.map((p) => p.key) };
}
