"use client";

import { Button, Card } from "@heroui/react";
import { useTranslations } from "next-intl";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("projects.error");

  // Heuristic preserved from before i18n: surface a credentials-specific
  // hint when the error string smells like an auth failure. Regex stays
  // English-only on purpose — the strings it matches come from
  // libraries (PostgrestError, JiraClient, "missing env") that don't
  // localize either.
  const looksLikeAuth =
    /credential|authentication|unauthori[sz]ed|forbidden|401|403|missing.*env/i.test(
      error.message ?? "",
    );

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Card>
        <Card.Header>
          <Card.Title>{t("title")}</Card.Title>
          <Card.Description>
            {looksLikeAuth ? t("description.auth") : t("description.generic")}
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <p className="text-sm text-muted">
            {t("detailLabel")}{" "}
            <span className="font-mono">{error.message}</span>
            {error.digest ? (
              <>
                {" "}
                · {t("digestLabel")}{" "}
                <span className="font-mono">{error.digest}</span>
              </>
            ) : null}
          </p>
        </Card.Content>
        <Card.Footer>
          <Button onPress={reset}>{t("retry")}</Button>
        </Card.Footer>
      </Card>
    </main>
  );
}
