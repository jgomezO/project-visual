import { LoginButton } from "./LoginButton";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  domain:
    "Solo cuentas @veevart.com pueden acceder. Si tu email es de Veevart pero ves este mensaje, contactá al administrador.",
  jira: "Tu cuenta @veevart.com no tiene acceso a Jira. Contactá al administrador para que te de acceso.",
  unknown: "Hubo un problema al iniciar sesión. Intentá de nuevo.",
};

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? ERROR_MESSAGES.unknown)
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-default-50 p-6">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-default-200 bg-surface p-8 shadow-sm">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Project Visual</h1>
          <p className="text-sm text-muted">
            Iniciá sesión para acceder al dashboard.
          </p>
        </header>

        {errorMessage ? (
          <div
            className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </div>
        ) : null}

        <LoginButton />

        <p className="text-xs text-muted">Solo cuentas @veevart.com.</p>
      </div>
    </main>
  );
}
