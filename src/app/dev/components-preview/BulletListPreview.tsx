"use client";

import { useState } from "react";
import { BulletListInput } from "@/components/narrative-editor/BulletListInput";

// Stateful playground for BulletListInput. Lives next to the page so the
// page itself stays a Server Component (matching the rest of the dev
// preview).
export function BulletListPreview() {
  const [impacts, setImpacts] = useState<string[]>([
    "Caída del checkout durante el período de migración",
  ]);
  const [mitigations, setMitigations] = useState<string[]>([
    "Feature flag por usuario para rollout incremental",
    "Plan de rollback documentado y ensayado en staging",
  ]);

  return (
    <div className="grid gap-6 rounded-md border border-default-200 bg-default-50/40 p-4 md:grid-cols-2">
      <BulletListInput
        label="Impactos"
        value={impacts}
        onChange={setImpacts}
        placeholder="Describí un impacto…"
      />
      <BulletListInput
        label="Mitigaciones"
        value={mitigations}
        onChange={setMitigations}
        placeholder="Describí una mitigación…"
        errorMessage={
          mitigations.length === 0 ? "Mínimo un elemento" : null
        }
      />
    </div>
  );
}
