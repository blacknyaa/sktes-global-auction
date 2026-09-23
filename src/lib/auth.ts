import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role } from "./constants";
import { sessionSecret, usingBundledDemoDb } from "./runtime";

export const SESSION_COOKIE = "sktes_session";
export const MFA_COOKIE = "sktes_mfa_pending";
const SESSION_DAYS = 7;

/** Failed sign-ins tolerated before the account locks. */
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

const secretKey = new TextEncoder().encode(
  sessionSecret()
);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "127.0.0.1"
  );
}

export async function userAgent(): Promise<string> {
  return (await headers()).get("user-agent") ?? "unknown";
}

// --- session ---------------------------------------------------------------

/**
 * The cookie carries a random token, and alongside it a signed statement of
 * who the token belongs to.
 *
 * Normally the token alone is enough: it is hashed and looked up in the
 * Session table, which is what makes "sign out every other device" work. But
 * on a serverless host running without a configured database, consecutive
 * requests land on different instances - twenty of them in one browsing
 * session, measured - each with its own copy of the bundled demo data. The
 * session row written during sign-in simply is not there on the next request.
 *
 * So the cookie also carries a signed user id. It is only ever trusted when
 * the row is missing *and* the app is running on the bundled demo database,
 * where every instance holds the identical seeded users. With a real database
 * configured, the row is authoritative and revocation behaves exactly as it
 * should.
 */
async function signSessionCookie(token: string, userId: string): Promise<string> {
  const claim = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey);
  return `${token}.${claim}`;
}

async function readSessionCookie(
  value: string
): Promise<{ token: string; userId: string | null }> {
  const dot = value.indexOf(".");
  if (dot === -1) return { token: value, userId: null };
  const token = value.slice(0, dot);
  try {
    const { payload } = await jwtVerify(value.slice(dot + 1), secretKey);
    return { token, userId: (payload.uid as string) ?? null };
  } catch {
    return { token, userId: null };
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt,
      ip: await clientIp(),
      userAgent: await userAgent(),
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, await signSessionCookie(token, userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: process.env.NODE_ENV === "production",
  });
}

/** The random half of the session cookie, for callers that need to keep the
 * current device signed in while revoking the others. */
export async function currentSessionToken(): Promise<string | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return (await readSessionCookie(raw)).token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    const { token } = await readSessionCookie(raw);
    await prisma.session
      .deleteMany({ where: { tokenHash: sha256(token) } })
      .catch(() => undefined);
  }
  // Clearing the cookie is what actually ends the session: without it the
  // signed identity inside would still be accepted on the demo database.
  store.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: string;
  email: string;
  loginId: string | null;
  name: string;
  role: Role;
  locale: string;
  timezone: string;
  status: string;
  mfaEnabled: boolean;
  companyId: string | null;
  company: {
    id: string;
    name: string;
    nameEn: string;
    type: string;
    status: string;
    countryCode: string;
    bidLimitCents: number | null;
  } | null;
};

/**
 * Resolved once per request thanks to React cache, so a page that asks for
 * the current user in five places still performs one query.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const { token, userId } = await readSessionCookie(raw);

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { company: true } } },
  });

  // See signSessionCookie: the signed identity stands in for the session row
  // only on the bundled demo database, where the row cannot be shared between
  // instances but every instance holds the same users.
  let u = session && session.expiresAt >= new Date() ? session.user : null;
  if (!u && userId && usingBundledDemoDb()) {
    u = await prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
  }
  if (!u) return null;
  if (u.status === "DISABLED") return null;

  return {
    id: u.id,
    email: u.email,
    loginId: u.loginId,
    name: u.name,
    role: u.role as Role,
    locale: u.locale,
    timezone: u.timezone,
    status: u.status,
    mfaEnabled: u.mfaEnabled,
    companyId: u.companyId,
    company: u.company
      ? {
          id: u.company.id,
          name: u.company.name,
          nameEn: u.company.nameEn,
          type: u.company.type,
          status: u.company.status,
          countryCode: u.company.countryCode,
          bidLimitCents: u.company.bidLimitCents,
        }
      : null,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/denied");
  return user;
}

/** A buyer may only place bids once their company has cleared review. */
export function canBid(user: SessionUser): boolean {
  return (
    user.role === "BIDDER" &&
    user.status === "ACTIVE" &&
    (user.company?.status === "APPROVED" || user.company?.status === "PROVISIONAL")
  );
}

// --- credentials -----------------------------------------------------------

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export type LoginOutcome =
  | { ok: true; userId: string; mfaRequired: boolean }
  | { ok: false; reason: "INVALID" | "LOCKED" | "DISABLED"; lockedUntil?: Date };

/** Lower-case letters, digits, dot, hyphen, underscore; 3 to 32 characters. */
export const LOGIN_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeLoginId(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function attemptLogin(
  loginId: string,
  password: string
): Promise<LoginOutcome> {
  const user = await prisma.user.findUnique({
    where: { loginId: normalizeLoginId(loginId) },
  });

  // Same generic answer whether the ID exists or not, so the form cannot be
  // used to discover which IDs are registered.
  if (!user) return { ok: false, reason: "INVALID" };

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { ok: false, reason: "LOCKED", lockedUntil: user.lockedUntil };
  }
  if (user.status === "DISABLED") return { ok: false, reason: "DISABLED" };

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const lockedUntil = await recordFailedLogin(user);
    return lockedUntil
      ? { ok: false, reason: "LOCKED", lockedUntil }
      : { ok: false, reason: "INVALID" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      // With MFA on, the password is only half of the sign-in. Resetting the
      // counter here would let anyone holding the password re-enter it to
      // earn fresh guesses at the code; it is reset once the code is right.
      ...(user.mfaEnabled ? {} : { failedLoginCount: 0, lockedUntil: null }),
      status: user.status === "LOCKED" ? "ACTIVE" : user.status,
      lastLoginAt: new Date(),
    },
  });

  return { ok: true, userId: user.id, mfaRequired: user.mfaEnabled };
}

/**
 * Counts one failed attempt, whether a wrong password or a wrong MFA code,
 * and locks the account once the limit is reached. Returns the lock expiry
 * when this attempt locked it.
 */
export async function recordFailedLogin(user: {
  id: string;
  status: string;
  failedLoginCount: number;
}): Promise<Date | null> {
  const failed = user.failedLoginCount + 1;
  const lockedUntil =
    failed >= MAX_FAILED_LOGINS
      ? new Date(Date.now() + LOCK_MINUTES * 60_000)
      : null;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: lockedUntil ? 0 : failed,
      lockedUntil,
      status: lockedUntil ? "LOCKED" : user.status,
    },
  });
  return lockedUntil;
}

// --- the short-lived ticket between password and MFA -----------------------

export async function issueMfaTicket(userId: string): Promise<void> {
  const jwt = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(secretKey);

  const store = await cookies();
  store.set(MFA_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function readMfaTicket(): Promise<string | null> {
  const store = await cookies();
  const jwt = store.get(MFA_COOKIE)?.value;
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, secretKey);
    return typeof payload.uid === "string" ? payload.uid : null;
  } catch {
    return null;
  }
}

export async function clearMfaTicket(): Promise<void> {
  (await cookies()).delete(MFA_COOKIE);
}

// --- password reset --------------------------------------------------------

/** How many reset links one account may be sent, and over what period. */
export const RESET_REQUESTS_PER_WINDOW = 3;
export const RESET_WINDOW_MINUTES = 60;

/**
 * Issues a reset link, or returns null when this account has already been
 * sent its allowance recently.
 *
 * Without a ceiling, anyone who knows an address can hold down the button:
 * the owner is mailed a reset link every time, and a row is stored for each.
 * Neither the caller nor the screen is told which happened, so this cannot be
 * used to find out whether an address is registered.
 */
export async function createPasswordResetToken(
  userId: string
): Promise<string | null> {
  const since = new Date(Date.now() - RESET_WINDOW_MINUTES * 60_000);
  const recent = await prisma.passwordResetToken.count({
    where: { userId, createdAt: { gte: since } },
  });
  if (recent >= RESET_REQUESTS_PER_WINDOW) return null;

  const token = randomBytes(24).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60 * 60_000),
    },
  });
  return token;
}

export async function consumePasswordResetToken(
  token: string,
  newPassword: string
): Promise<boolean> {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return false;

  const passwordHash = await hashPassword(newPassword);
  return prisma.$transaction(async (tx) => {
    // The check above is only a fast path. Claiming the token is the real
    // check: two requests racing with the same link both pass the read, but
    // only one of them can flip usedAt from null.
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (count === 0) return false;

    await tx.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        failedLoginCount: 0,
        lockedUntil: null,
        status: "ACTIVE",
      },
    });
    // Every other session is dropped, because a password reset is exactly the
    // moment you want any hijacked session to stop working.
    await tx.session.deleteMany({ where: { userId: row.userId } });
    return true;
  });
}

export { sha256 };
