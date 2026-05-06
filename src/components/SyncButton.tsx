"use client";

import { Button } from "@heroui/react";
import { useState, useTransition } from "react";
import { triggerSync } from "@/app/(app)/projects/actions";

type ButtonVariant =
  | "secondary"
  | "tertiary"
  | "outline"
  | "ghost"
  | "danger"
  | "danger-soft";

interface SyncButtonProps {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}

export function SyncButton({
  children = "Sincronizar ahora",
  variant,
  size,
}: SyncButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={variant}
        size={size}
        isPending={pending}
        isDisabled={pending}
        onPress={() => {
          setError(null);
          startTransition(async () => {
            const result = await triggerSync();
            if (result.status === "failed") {
              setError(result.errorMessage ?? "Falló la sincronización");
            }
          });
        }}
      >
        {pending ? "Sincronizando..." : children}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
