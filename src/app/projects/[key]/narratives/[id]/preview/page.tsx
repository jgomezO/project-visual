import { notFound } from "next/navigation";
import { NarrativeView } from "@/components/narrative-public/NarrativeView";
import {
  computeDerived,
  loadIssuesForNarrative,
} from "@/lib/narratives/derived";
import { getNarrativeById } from "@/lib/narratives/queries";
import { getAnonSupabase } from "@/lib/supabase/anon";


export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string; id: string }>;
  searchParams: Promise<{ mode?: string }>;
}

export default async function NarrativePreviewPage({
  params,
  searchParams,
}: PageProps) {
  const [{ key, id }, sp] = await Promise.all([params, searchParams]);

  const narrative = await getNarrativeById(id);
  if (!narrative) notFound();

  const supabase = getAnonSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("id, key, name")
    .eq("key", key)
    .maybeSingle();
  if (!project || project.id !== narrative.project_id) notFound();

  const { issuesByKey, childrenMap } = await loadIssuesForNarrative(narrative);
  const derived = computeDerived(narrative, issuesByKey, childrenMap);

  const mode = sp.mode === "presentation" ? "presentation" : "normal";

  return (
    <NarrativeView
      narrative={narrative}
      projectKey={key}
      projectName={project.name ?? key}
      derived={derived}
      issuesByKey={issuesByKey}
      mode={mode}
    />
  );
}
