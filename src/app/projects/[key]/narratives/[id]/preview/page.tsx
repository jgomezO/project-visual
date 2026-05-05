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

// Three-stage load — see CLAUDE.md "Query waves":
//   Wave 1: narrative + project lookup, both by URL params, no inter-
//           dependency. Run in parallel. (`getNarrativeById` already does
//           its own 4-way Promise.all internally — phases+workstreams,
//           orphans, dependencies, risks — so wave 1 is two top-level
//           awaits, ~5 round-trips.)
//   Wave 2: issue closure. Depends on narrative.workstreams[].jira_issue_keys
//           plus the recursive parent→children fetch in `loadIssuesForNarrative`.
//   Compute: pure (no I/O) derivation of per-ws / per-phase / global stats.
//
// notFound() lives between wave 1 and wave 2 so a bogus URL doesn't pay the
// closure-fetch cost.
export default async function NarrativePreviewPage({
  params,
  searchParams,
}: PageProps) {
  const [{ key, id }, sp] = await Promise.all([params, searchParams]);

  // Wave 1: main entities, parallel.
  const supabase = getAnonSupabase();
  const [narrative, projectRes] = await Promise.all([
    getNarrativeById(id),
    supabase
      .from("projects")
      .select("id, key, name")
      .eq("key", key)
      .maybeSingle(),
  ]);
  if (!narrative) notFound();
  const project = projectRes.data;
  if (!project || project.id !== narrative.project_id) notFound();

  // Wave 2: issue closure — depends on narrative loaded in wave 1.
  const { issuesByKey, childrenMap } = await loadIssuesForNarrative(narrative);

  // Compute: pure, no I/O.
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
