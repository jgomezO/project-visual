"use client";

import { Button, Card } from "@heroui/react";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const looksLikeAuth =
    /credential|authentication|unauthori[sz]ed|forbidden|401|403|missing.*env/i.test(
      error.message ?? "",
    );

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Card>
        <Card.Header>
          <Card.Title>No se pudieron cargar los proyectos</Card.Title>
          <Card.Description>
            {looksLikeAuth
              ? "Parece un problema de credenciales. Verificá JIRA_BASE_URL, JIRA_EMAIL y JIRA_API_TOKEN en tu .env.local."
              : "Hubo un error al consultar Jira. Probá de nuevo en unos segundos."}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <p className="text-sm text-muted">
            Detalle: <span className="font-mono">{error.message}</span>
            {error.digest ? (
              <>
                {" "}
                · digest: <span className="font-mono">{error.digest}</span>
              </>
            ) : null}
          </p>
        </Card.Content>
        <Card.Footer>
          <Button onPress={reset}>Reintentar</Button>
        </Card.Footer>
      </Card>
    </main>
  );
}
