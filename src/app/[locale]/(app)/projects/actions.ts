"use server";

import { revalidatePath } from "next/cache";
import { runSync, type RunSyncResult } from "@/lib/sync";

export async function triggerSync(): Promise<RunSyncResult> {
  // "manual" because this Server Action is invoked by the SyncButton
  // in the projects Hero. The Vercel Cron route handler (iter 6,
  // /api/cron/sync-jira) calls runSync() directly with 'cron' to
  // distinguish scheduled health from PM-clicked refreshes.
  const result = await runSync({ triggeredBy: "manual" });
  // Pattern includes the [locale] segment so both /en/projects and
  // /es/projects get invalidated when sync completes — sync state is
  // language-independent.
  revalidatePath("/[locale]/projects", "page");
  return result;
}
