"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  attemptLogin,
  claimTotpStep,
  clearMfaTicket,
  createSession,
  issueMfaTicket,
  readMfaTicket,
  recordFailedLogin,
} from "@/lib/auth";
import { matchTotpStep } from "@/lib/totp";
import { writeAudit } from "@/lib/audit";

export type LoginState = { error?: string; lockedUntil?: string };

const loginSchema = z.object({
  loginId: z.string().min(3).max(32),
  password: z.string().min(1),
});

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    loginId: String(formData.get("loginId") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "INVALID" };

  const outcome = await attemptLogin(parsed.data.loginId, parsed.data.password);

  if (!outcome.ok) {
    await writeAudit({
      actorLabel: parsed.data.loginId,
      action: "LOGIN_FAILED",
      summary: `${parsed.data.loginId} のログインに失敗（${outcome.reason}）`,
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
    actorLabel: user?.name ?? parsed.data.loginId,
    action: "LOGIN",
    summary: `${user?.loginId ?? parsed.data.loginId} がログインしました`,
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

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await clearMfaTicket();
    return { error: "LOCKED" };
  }

  const step = matchTotpStep(user.mfaSecret, code);
  if (step === null || !(await claimTotpStep(user.id, step))) {
    const lockedUntil = await recordFailedLogin(user);
    await writeAudit({
      actorUserId: user.id,
      actorLabel: user.name,
      action: "LOGIN_FAILED",
      summary: lockedUntil
        ? `${user.loginId ?? user.email} のMFAコードが続けて一致せず、アカウントをロックしました`
        : step === null
          ? `${user.loginId ?? user.email} のMFAコードが一致しませんでした`
          : `${user.loginId ?? user.email} に使用済みのMFAコードが送られました`,
    });
    if (lockedUntil) {
      await clearMfaTicket();
      return { error: "LOCKED" };
    }
    return { error: "INVALID" };
  }

  await clearMfaTicket();
  await createSession(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });
  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.name,
    action: "LOGIN",
    summary: `${user.loginId ?? user.email} がMFA認証を通過してログインしました`,
  });
  redirect("/dashboard");
}
