import { getTranslations } from "next-intl/server";
import { LoginButton } from "./LoginButton";

export const dynamic = "force-dynamic";

const VALID_ERROR_CODES = ["domain", "jira", "unknown"] as const;
type ValidErrorCode = (typeof VALID_ERROR_CODES)[number];

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  const t = await getTranslations("auth.login");

  // Map ?error=<code> to a translated message. Unknown codes fall back
  // to the generic "unknown" message so a tampered query param can't
  // crash the page.
  const errorCode: ValidErrorCode | null = error
    ? (VALID_ERROR_CODES as readonly string[]).includes(error)
      ? (error as ValidErrorCode)
      : "unknown"
    : null;
  const errorMessage = errorCode ? t(`errors.${errorCode}`) : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-default-50 p-6">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-default-200 bg-surface p-8 shadow-sm">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("heading")}
          </h1>
          <p className="text-sm text-muted">{t("subheading")}</p>
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

        <p className="text-xs text-muted">{t("helper")}</p>
      </div>
    </main>
  );
}
