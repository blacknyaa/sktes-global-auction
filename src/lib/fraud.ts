import { prisma } from "./prisma";

/**
 * Fraud monitoring.
 *
 * These are rules, not a model, and that is deliberate. A machine-learning
 * classifier needs labelled fraud to learn from, and on day one there is none.
 * Rules catch the obvious cases immediately, and every rule that fires becomes
 * a labelled example - which is what a model would need later anyway.
 *
 * Everything here is computed live from the current data, so the screen shows
 * what is actually true rather than a snapshot someone generated once.
 */

export type MultiAccountFinding = {
  reason: "SHARED_CORPORATE_NUMBER" | "SHARED_IP";
  key: string;
  companies: { id: string; name: string; countryCode: string; status: string }[];
};

export async function detectMultiAccounts(): Promise<MultiAccountFinding[]> {
  const findings: MultiAccountFinding[] = [];

  // 1. Two buyer companies filed the same national company number.
  const withNumbers = await prisma.company.findMany({
    where: { type: "BUYER", corporateNumber: { not: null } },
    select: {
      id: true,
      name: true,
      countryCode: true,
      status: true,
      corporateNumber: true,
    },
  });
  const byNumber = new Map<string, typeof withNumbers>();
  for (const c of withNumbers) {
    const key = c.corporateNumber!;
    byNumber.set(key, [...(byNumber.get(key) ?? []), c]);
  }
  for (const [key, group] of byNumber) {
    if (group.length > 1) {
      findings.push({
        reason: "SHARED_CORPORATE_NUMBER",
        key,
        companies: group.map(({ id, name, countryCode, status }) => ({
          id,
          name,
          countryCode,
          status,
        })),
      });
    }
  }

  // 2. Bids from different companies arrived from the same address.
  const bids = await prisma.bid.findMany({
    where: { ip: { not: null } },
    select: {
      ip: true,
      bidderCompanyId: true,
      bidderCompany: {
        select: { id: true, name: true, countryCode: true, status: true },
      },
    },
  });
  const byIp = new Map<string, Map<string, MultiAccountFinding["companies"][0]>>();
  for (const b of bids) {
    if (!b.ip) continue;
    const bucket = byIp.get(b.ip) ?? new Map();
    bucket.set(b.bidderCompanyId, b.bidderCompany);
    byIp.set(b.ip, bucket);
  }
  for (const [ip, bucket] of byIp) {
    if (bucket.size > 1) {
      findings.push({
        reason: "SHARED_IP",
        key: ip,
        companies: [...bucket.values()],
      });
    }
  }

  return findings;
}

export type AbnormalBidFinding = {
  lotId: string;
  lotNumber: string;
  companyName: string;
  amountCents: number;
  medianCents: number;
  multiple: number;
};

/**
 * A bid far above the middle of the pack is either a serious buyer or a
 * fat-fingered zero. Either way an operator should see it before the award.
 */
export async function detectAbnormalBids(
  threshold = 2.5
): Promise<AbnormalBidFinding[]> {
  const lots = await prisma.lot.findMany({
    where: { status: { in: ["CLOSED", "AWARDED"] } },
    select: {
      id: true,
      lotNumber: true,
      bids: {
        where: { status: "REVEALED", amountCents: { not: null } },
        select: {
          amountCents: true,
          bidderCompany: { select: { name: true } },
        },
      },
    },
    take: 200,
  });

  const findings: AbnormalBidFinding[] = [];
  for (const lot of lots) {
    if (lot.bids.length < 3) continue;
    const amounts = lot.bids
      .map((b) => b.amountCents!)
      .sort((a, b) => a - b);
    const mid = Math.floor(amounts.length / 2);
    const median =
      amounts.length % 2 === 0
        ? Math.round((amounts[mid - 1] + amounts[mid]) / 2)
        : amounts[mid];
    if (median <= 0) continue;

    for (const b of lot.bids) {
      const multiple = b.amountCents! / median;
      if (multiple >= threshold) {
        findings.push({
          lotId: lot.id,
          lotNumber: lot.lotNumber,
          companyName: b.bidderCompany.name,
          amountCents: b.amountCents!,
          medianCents: median,
          multiple: Math.round(multiple * 10) / 10,
        });
      }
    }
  }
  return findings.sort((a, b) => b.multiple - a.multiple);
}

export type AccessAnomalyFinding = {
  ip: string;
  failedLogins: number;
  distinctActors: number;
  lastAt: Date;
};

export async function detectAccessAnomalies(
  minFailures = 3
): Promise<AccessAnomalyFinding[]> {
  const rows = await prisma.auditLog.findMany({
    where: { action: "LOGIN_FAILED", ip: { not: null } },
    select: { ip: true, actorLabel: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });

  const byIp = new Map<
    string,
    { count: number; actors: Set<string>; lastAt: Date }
  >();
  for (const r of rows) {
    const cur = byIp.get(r.ip!) ?? {
      count: 0,
      actors: new Set<string>(),
      lastAt: r.createdAt,
    };
    cur.count++;
    cur.actors.add(r.actorLabel);
    if (r.createdAt > cur.lastAt) cur.lastAt = r.createdAt;
    byIp.set(r.ip!, cur);
  }

  return [...byIp.entries()]
    .filter(([, v]) => v.count >= minFailures)
    .map(([ip, v]) => ({
      ip,
      failedLogins: v.count,
      distinctActors: v.actors.size,
      lastAt: v.lastAt,
    }))
    .sort((a, b) => b.failedLogins - a.failedLogins);
}
