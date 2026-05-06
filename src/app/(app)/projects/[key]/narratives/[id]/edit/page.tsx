import { notFound } from "next/navigation";
import { EditorShell } from "@/components/narrative-editor/EditorShell";
import { getNarrativeById } from "@/lib/narratives/queries";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string; id: string }>;
}

export default async function NarrativeEditPage({ params }: PageProps) {
  const { key, id } = await params;

  const narrative = await getNarrativeById(id);
  if (!narrative) notFound();

  // Defensive check: the URL might point at a narrative from another project.
  const supabase = await getServerSupabase();
  const { data: project } = await supabase
    .from("projects")
    .select("id, key, name")
    .eq("key", key)
    .maybeSingle();
  if (!project || project.id !== narrative.project_id) notFound();

  return (
    <EditorShell
      projectKey={key}
      projectName={project.name ?? key}
      initialNarrative={narrative}
    />
  );
}
