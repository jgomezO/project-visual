"use server";

import { revalidatePath } from "next/cache";
import { runSync, type RunSyncResult } from "@/lib/sync";

export async function triggerSync(): Promise<RunSyncResult> {
  const result = await runSync();
  revalidatePath("/projects");
  return result;
}
