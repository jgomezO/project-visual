"use server";

import { revalidatePath } from "next/cache";
import { runSync, type RunSyncResult } from "@/lib/sync";

export async function triggerSync(): Promise<RunSyncResult> {
  const result = await runSync();
  // Pattern includes the [locale] segment so both /en/projects and
  // /es/projects get invalidated when sync completes — sync state is
  // language-independent.
  revalidatePath("/[locale]/projects", "page");
  return result;
}
