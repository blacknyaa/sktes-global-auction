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
  // Disabled accounts must not receive a reset link. Same generic reply so
  // the form cannot reveal that the address belongs to a suspended member.
  if (user.status === "DISABLED") return { sent: true };

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
    unrecordedExtra: link,
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
