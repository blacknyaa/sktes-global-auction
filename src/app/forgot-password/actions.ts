"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
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
  if (!token) {
    // Already sent its allowance for the hour. The screen says the same thing
    // as a successful request, so holding down the button tells an attacker
    // nothing and stops reaching the account's owner.
    await writeAudit({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "PASSWORD_RESET",
      summary: `${user.email} の再設定申請が続いたため、送信を見送りました`,
    });
    return { sent: true };
  }
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

  // Shown on screen only because the demo has no mail server attached.
  return { sent: true, demoLink: link };
}
