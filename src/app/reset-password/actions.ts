"use server";

import { consumePasswordResetToken } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

export type ResetState = { done?: boolean; error?: "MISMATCH" | "POLICY" | "INVALID" };

/** At least 8 characters with both letters and digits. */
function passwordMeetsPolicy(value: string): boolean {
  return value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}

export async function resetAction(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password !== confirm) return { error: "MISMATCH" };
  if (!passwordMeetsPolicy(password)) return { error: "POLICY" };

  const ok = await consumePasswordResetToken(token, password);
  if (!ok) return { error: "INVALID" };

  await writeAudit({
    actorLabel: "password-reset",
    action: "PASSWORD_RESET",
    summary: "再設定リンクからパスワードが変更されました（全セッション破棄）",
  });

  return { done: true };
}
