"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { triggerSync } from "@/app/(app)/projects/actions";

interface SyncButtonProps {
  children?: React.ReactNode;
  // Subset of the Button primitive's variants — sync is either the
  // primary CTA on the empty state ("Sincronizar ahora") or a secondary
  // pill in the populated header ("Resincronizar"). No need to expose
  // the full ghost / circular surface area here.
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}

export function SyncButton({
  children = "Sincronizar ahora",
  variant = "primary",
  size = "md",
}: SyncButtonProps) {
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
              setError(result.errorMessage ?? "Falló la sincronización");
            }
          });
        }}
      >
        <RefreshCw
          className={`size-4 ${pending ? "animate-spin motion-reduce:animate-none" : ""}`}
          aria-hidden="true"
        />
        {pending ? "Sincronizando..." : children}
      </Button>
      {error ? <p className="text-sm text-error">{error}</p> : null}
    </div>
  );
}
