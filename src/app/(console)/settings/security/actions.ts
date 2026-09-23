"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  claimTotpStep,
  hashPassword,
  requireUser,
  sha256,
  verifyPassword,
} from "@/lib/auth";
import { generateTotpSecret, matchTotpStep } from "@/lib/totp";
import { writeAudit } from "@/lib/audit";
import { currentSessionToken } from "@/lib/auth";

export type SecurityState = { ok?: string; error?: string };

/** Creates a secret but leaves MFA switched off until a code is verified. */
export async function beginMfaAction(): Promise<void> {
  const user = await requireUser();
  const existing = await prisma.user.findUnique({ where: { id: user.id } });
  if (!existing?.mfaSecret) {
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaSecret: generateTotpSecret(), mfaEnabled: false },
    });
  }
  revalidatePath("/settings/security");
}

export async function enableMfaAction(
  _prev: SecurityState,
  formData: FormData
): Promise<SecurityState> {
  const user = await requireUser();
  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row?.mfaSecret) return { error: "SETUP" };

  const code = String(formData.get("code") ?? "");
  const step = matchTotpStep(row.mfaSecret, code);
  if (step === null || !(await claimTotpStep(user.id, step))) {
    return { error: "INVALID" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true },
  });
  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.name,
    action: "MFA_ENROLLED",
    summary: `${user.email} が多要素認証を有効にしました`,
  });
  revalidatePath("/settings/security");
  return { ok: "ENABLED" };
}

export async function disableMfaAction(
  _prev: SecurityState,
  formData: FormData
): Promise<SecurityState> {
  const user = await requireUser();
  const password = String(formData.get("password") ?? "");
  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row?.mfaEnabled) return { error: "SETUP" };
  if (!(await verifyPassword(password, row.passwordHash))) {
    return { error: "CURRENT" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null, mfaLastStep: null },
  });
  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.name,
    action: "MFA_ENROLLED",
    summary: `${user.email} が多要素認証を無効にしました`,
  });
  revalidatePath("/settings/security");
  return { ok: "DISABLED" };
}

export async function changePasswordAction(
  _prev: SecurityState,
  formData: FormData
): Promise<SecurityState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next !== confirm) return { error: "MISMATCH" };
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(next)) return { error: "POLICY" };

  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    return { error: "CURRENT" };
  }

  const passwordHash = await hashPassword(next);
  const token = await currentSessionToken();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    }),
    prisma.session.deleteMany({
      where: {
        userId: user.id,
        ...(token ? { NOT: { tokenHash: sha256(token) } } : {}),
      },
    }),
  ]);
  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.name,
    action: "PASSWORD_RESET",
    summary: `${user.email} がパスワードを変更し、他端末のセッションを破棄しました`,
  });
  revalidatePath("/settings/security");
  return { ok: "CHANGED" };
}

export async function revokeOtherSessionsAction(): Promise<void> {
  const user = await requireUser();
  const token = await currentSessionToken();
  await prisma.session.deleteMany({
    where: {
      userId: user.id,
      ...(token ? { NOT: { tokenHash: sha256(token) } } : {}),
    },
  });
  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.name,
    action: "ADMIN_ACTION",
    summary: `${user.email} が他端末のセッションを破棄しました`,
  });
  revalidatePath("/settings/security");
}
