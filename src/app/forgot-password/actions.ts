"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { writeAudit } from "@/lib/audit";
import type { Locale } from "@/lib/constants";

export type ForgotState = { sent?: boolean; demoLink?: string; error?: string };

/** Unused links one account may have outstanding from the last hour. */
const MAX_OPEN_LINKS_PER_HOUR = 3;

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

  // Anyone can type a stranger's address here, and each request mails them.
  // Links that were actually used do not count, so a person who resets and
  // later forgets again is never held back by their own earlier reset.
  const open = await prisma.passwordResetToken.count({
    where: {
      userId: user.id,
      usedAt: null,
      createdAt: { gt: new Date(Date.now() - 60 * 60_000) },
    },
  });
  if (open >= MAX_OPEN_LINKS_PER_HOUR) return { sent: true };

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

  // Shown on screen only because the demo has no mail server attached.
  return { sent: true, demoLink: link };
}
