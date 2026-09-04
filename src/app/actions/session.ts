"use server";

import { redirect } from "next/navigation";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    await writeAudit({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "LOGOUT",
      summary: `${user.email} がログアウトしました`,
    });
  }
  await destroySession();
  redirect("/login");
}
