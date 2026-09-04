import { prisma } from "./prisma";
import { clientIp, userAgent } from "./auth";
import { AUDIT_RETENTION_YEARS, type AuditAction } from "./constants";

/**
 * Every state change that matters passes through here. The brief asks for
 * login, listing, bidding, amount changes, award confirmation and admin
 * actions to be retained for five to seven years, so each row carries its
 * own retention date and the actor label is denormalised - the log has to
 * stay readable even if the user record is later deleted.
 */
export async function writeAudit(input: {
  actorUserId?: string | null;
  actorLabel: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  summary: string;
  detail?: unknown;
}): Promise<void> {
  const now = new Date();
  const retentionUntil = new Date(now);
  retentionUntil.setFullYear(retentionUntil.getFullYear() + AUDIT_RETENTION_YEARS);

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      summary: input.summary,
      detail: input.detail === undefined ? null : JSON.stringify(input.detail),
      ip: await clientIp().catch(() => null),
      userAgent: await userAgent().catch(() => null),
      createdAt: now,
      retentionUntil,
    },
  });
}

/** Lightweight request log, kept separate from the audit trail. */
export async function writeAccessLog(input: {
  userId?: string | null;
  path: string;
  method?: string;
  statusCode?: number;
  country?: string | null;
}): Promise<void> {
  await prisma.accessLog
    .create({
      data: {
        userId: input.userId ?? null,
        ip: await clientIp().catch(() => "0.0.0.0"),
        country: input.country ?? null,
        method: input.method ?? "GET",
        path: input.path,
        statusCode: input.statusCode ?? 200,
        userAgent: await userAgent().catch(() => null),
      },
    })
    .catch(() => undefined);
}
