"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { destroySession } from "@/lib/auth";

/**
 * Resets the demo to its opening position.
 *
 * Every account is recreated, so the current session is deliberately dropped
 * and the operator is returned to the sign-in screen. Only available while
 * DEMO_MODE is on - in a real deployment this action does not exist.
 */
export async function resetDemoAction(): Promise<void> {
  await requireRole("ADMIN");
  if (process.env.DEMO_MODE !== "true") return;

  const { runSeed } = await import("../../../../../prisma/seed/index");
  await runSeed();

  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login?reset=1");
}
