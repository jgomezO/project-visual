import Link from "next/link";
import { Card } from "@heroui/react";

export default function ProjectNotFound() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <Card>
        <Card.Header>
          <Card.Title>Proyecto no encontrado</Card.Title>
          <Card.Description>
            Este proyecto no existe en la base local. Puede que falte
            sincronizar, o que la key sea incorrecta.
          </Card.Description>
        </Card.Header>
        <Card.Footer>
          <Link href="/projects" className="underline">
            Volver al listado
          </Link>
        </Card.Footer>
      </Card>
    </main>
  );
}
