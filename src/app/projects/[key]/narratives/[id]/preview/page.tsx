import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ key: string; id: string }>;
}

export default async function NarrativePreviewPage({ params }: PageProps) {
  const { key } = await params;
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8 text-center">
      <h1 className="text-xl font-semibold">Vista previa próximamente</h1>
      <p className="text-sm text-muted">
        La vista pública de la narrativa llega en la siguiente iteración (4c).
        Mientras tanto, podés seguir editando desde el editor.
      </p>
      <Link
        href={`/projects/${key}/narratives`}
        className="inline-block text-sm underline"
      >
        Volver al listado de narrativas
      </Link>
    </main>
  );
}
