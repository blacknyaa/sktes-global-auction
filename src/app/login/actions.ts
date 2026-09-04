"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  attemptLogin,
  clearMfaTicket,
  createSession,
  issueMfaTicket,
  readMfaTicket,
} from "@/lib/auth";
import { verifyTotp } from "@/lib/totp";
import { writeAudit } from "@/lib/audit";

export type LoginState = { error?: string; lockedUntil?: string };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "INVALID" };

  const outcome = await attemptLogin(parsed.data.email, parsed.data.password);

  if (!outcome.ok) {
    await writeAudit({
      actorLabel: parsed.data.email,
      action: "LOGIN_FAILED",
      summary: `${parsed.data.email} のログインに失敗（${outcome.reason}）`,
      detail: { reason: outcome.reason },
    });
    return {
      error: outcome.reason,
      lockedUntil: outcome.lockedUntil?.toISOString(),
    };
  }

  if (outcome.mfaRequired) {
    await issueMfaTicket(outcome.userId);
    redirect("/login/mfa");
  }

  await createSession(outcome.userId);
  const user = await prisma.user.findUnique({ where: { id: outcome.userId } });
  await writeAudit({
    actorUserId: outcome.userId,
    actorLabel: user?.name ?? parsed.data.email,
    action: "LOGIN",
    summary: `${parsed.data.email} がログインしました`,
  });
  redirect("/dashboard");
}

export type MfaState = { error?: string };

export async function mfaAction(
  _prev: MfaState,
  formData: FormData
): Promise<MfaState> {
  const userId = await readMfaTicket();
  if (!userId) return { error: "EXPIRED" };

  const code = String(formData.get("code") ?? "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaSecret) return { error: "EXPIRED" };

  if (!verifyTotp(user.mfaSecret, code)) {
    await writeAudit({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "LOGIN_FAILED",
      summary: `${user.email} のMFAコードが一致しませんでした`,
    });
    return { error: "INVALID" };
  }

  await clearMfaTicket();
  await createSession(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.name,
    action: "LOGIN",
    summary: `${user.email} がMFA認証を通過してログインしました`,
  });
  redirect("/dashboard");
}
