"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import { demoModeEnabled } from "@/lib/runtime";
import type { Locale } from "@/lib/constants";

export type ForgotState = { sent?: boolean; demoLink?: string; error?: string };

export async function forgotAction(
  _prev: ForgotState,
  formData: FormData
): Promise<ForgotState> {
  const parsed = z
    .string()
    .email()
    .safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "INVALID" };

  const user = await prisma.user.findUnique({ where: { email: parsed.data } });

  // The response is identical whether or not the address exists.
  if (!user) return { sent: true };

  const token = await createPasswordResetToken(user.id);
  const link = `/reset-password?token=${token}`;

  await notify({
    userId: user.id,
    toAddress: user.email,
    templateKey: "password.reset",
    locale: user.locale as Locale,
    extra: link,
  });
  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.name,
    action: "PASSWORD_RESET",
    summary: `${user.email} がパスワード再設定を申請しました`,
  });

  // Anyone can type any address into this form, so handing the link back
  // would let them reset someone else's password. Only a disposable demo,
  // which has no mail server attached, may show it on screen.
  return demoModeEnabled() ? { sent: true, demoLink: link } : { sent: true };
}
