// Dev-only: pnpm seed:narrative
// Loads .env.local via Node's --env-file flag (see package.json) and runs
// the idempotent demo-narrative seeder against the linked Supabase project.

import { seedDevNarrative } from "@/lib/narratives/seed";

async function main(): Promise<void> {
  const result = await seedDevNarrative();
  const verb = result.alreadyExisted ? "already exists" : "created";
  console.log(
    `[seed] narrative ${verb}: ${result.narrative.id} (${result.narrative.title})`,
  );
  console.log(`[seed]   phases: ${result.phases.length}`);
  console.log(`[seed]   workstreams: ${result.workstreams.length}`);
  for (const w of result.workstreams) {
    const where = w.phase_id ? `phase=${w.phase_id}` : "orphan";
    console.log(
      `[seed]     - ${w.name} [${where}] keys=${w.jira_issue_keys.join(",")}`,
    );
  }
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
