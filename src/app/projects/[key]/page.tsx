import { notFound } from "next/navigation";
import { getAnonSupabase } from "@/lib/supabase/anon";
import { KpiHeader, type DashboardData } from "@/components/project/KpiHeader";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string }>;
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { key } = await params;
  const supabase = getAnonSupabase();

  const { data: rows, error } = await supabase.rpc("project_dashboard", {
    p_project_key: key,
  });
  if (error) throw error;

  const dashboard = (rows?.[0] ?? null) as DashboardData | null;
  if (!dashboard) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 p-8">
      <KpiHeader data={dashboard} />

      {/* Tabla de issues — commit 17 de iter 3a */}
      <section className="rounded-2xl border-2 border-dashed border-default-300 p-12 text-center text-muted">
        Tabla de issues — próximo commit
      </section>
    </main>
  );
}
