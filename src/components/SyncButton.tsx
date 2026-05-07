"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui";
import { triggerSync } from "@/app/[locale]/(app)/projects/actions";

interface SyncButtonProps {
  // Two display modes drive the label via i18n keys:
  //   - 'idle'    → "Resync" / "Resincronizar" (on the populated header)
  //   - 'initial' → "Sync now" / "Sincronizar ahora" (on the empty state)
  // Pending and error states are owned internally; callers don't see them.
  mode?: "idle" | "initial";
  // Subset of the Button primitive's variants — sync is either the
  // primary CTA on the empty state or a secondary pill in the
  // populated header. No need to expose ghost / circular here.
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}

export function SyncButton({
  mode = "initial",
  variant = "primary",
  size = "md",
}: SyncButtonProps) {
  const t = useTranslations("projects.syncButton");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await triggerSync();
            if (result.status === "failed") {
              // Server-thrown messages (Jira / Postgrest) flow through
              // unchanged — heterogeneous and not realistically
              // localizable from this side. Falls back to the
              // translated generic string when no message is available.
              setError(result.errorMessage ?? t("error"));
            }
          });
        }}
      >
        <RefreshCw
          className={`size-4 ${pending ? "animate-spin motion-reduce:animate-none" : ""}`}
          aria-hidden="true"
        />
        {pending ? t("pending") : t(mode)}
      </Button>
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
