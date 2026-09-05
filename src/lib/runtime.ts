import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Runtime configuration, and the rules for running with none.
 *
 * The demo has to survive being deployed with nothing configured. A reviewer
 * who clicks "deploy" and gets a stack trace learns nothing about the system,
 * so when no database and no secrets are supplied the app falls back to a
 * seeded database bundled at build time and to fixed demo secrets.
 *
 * These fallbacks are for the demonstration only, and the code says so loudly:
 * `usingFallbackSecrets()` is reported by /api/health and warned about in the
 * server log on boot. Supplying DATABASE_URL, SEAL_MASTER_KEY and
 * SESSION_SECRET switches every one of them off.
 */

/** Where the build-time seeded database is bundled. */
export const BUNDLED_DEMO_DB = path.join(process.cwd(), "prisma", "demo.db");

/**
 * A serverless filesystem is read-only except for the system temp directory,
 * which is /tmp there and somewhere else on a developer machine.
 */
export const RUNTIME_DEMO_DB = path.join(os.tmpdir(), "sktes-demo.db");

/**
 * Where a connection string might be hiding.
 *
 * Hosting integrations do not agree on a name. Neon's own Vercel integration
 * writes DATABASE_URL; Vercel Postgres writes POSTGRES_PRISMA_URL and friends;
 * some templates write POSTGRES_URL. Someone who has genuinely connected a
 * database should not then have to discover that we only read one of those
 * names, so all of them are accepted, pooled variants first because a
 * serverless host opens and drops connections constantly.
 */
export const DATABASE_URL_CANDIDATES = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_POSTGRES_URL",
] as const;

/**
 * Some integrations hand over the parts rather than a URL - host, user,
 * password, database - so if no ready-made connection string is present the
 * parts are assembled into one. Postgres over the public internet always
 * wants TLS, hence the sslmode.
 */
function assembleFromParts(): string | undefined {
  const host = process.env.PGHOST?.trim() ?? process.env.POSTGRES_HOST?.trim();
  const user = process.env.PGUSER?.trim() ?? process.env.POSTGRES_USER?.trim();
  const password =
    process.env.PGPASSWORD?.trim() ?? process.env.POSTGRES_PASSWORD?.trim();
  const database =
    process.env.PGDATABASE?.trim() ?? process.env.POSTGRES_DATABASE?.trim();
  if (!host || !user || !password || !database) return undefined;

  const port = process.env.PGPORT?.trim() || "5432";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
    password
  )}@${host}:${port}/${database}?sslmode=require`;
}

/** The first connection string actually present, or undefined. */
export function resolveDatabaseUrl(): string | undefined {
  for (const name of DATABASE_URL_CANDIDATES) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return assembleFromParts();
}

/** Which of the candidate names are set, for diagnostics. Never their values. */
export function presentDatabaseUrlNames(): string[] {
  return DATABASE_URL_CANDIDATES.filter((n) => Boolean(process.env[n]?.trim()));
}

export function hasDatabaseUrl(): boolean {
  return Boolean(resolveDatabaseUrl());
}

export function bundledDemoDbExists(): boolean {
  return existsSync(BUNDLED_DEMO_DB);
}

/** True when running off the bundled demo database rather than a real one. */
export function usingBundledDemoDb(): boolean {
  return !hasDatabaseUrl() && bundledDemoDbExists();
}

/**
 * Demo-only secrets. Not a security lapse hiding in plain sight - they exist
 * so an unconfigured deployment still demonstrates the sealed-bid mechanism
 * end to end. Any real deployment sets the environment variables and these are
 * never consulted.
 */
// 64 hexadecimal characters, as the sealing code requires.
const DEMO_SEAL_MASTER_KEY =
  "5ec0de3a5ec0de3a5ec0de3a5ec0de3a5ec0de3a5ec0de3a5ec0de3a5ec0de3a";
const DEMO_SESSION_SECRET =
  "sktes-demo-session-secret-not-for-production-use-0000000000";

export function sealMasterKey(): string {
  const fromEnv = process.env.SEAL_MASTER_KEY?.trim();
  return fromEnv && /^[0-9a-f]{64}$/i.test(fromEnv)
    ? fromEnv
    : DEMO_SEAL_MASTER_KEY;
}

export function sessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() || DEMO_SESSION_SECRET;
}

export function usingFallbackSecrets(): boolean {
  const seal = process.env.SEAL_MASTER_KEY?.trim();
  return !/^[0-9a-f]{64}$/i.test(seal ?? "") || !process.env.SESSION_SECRET?.trim();
}

/**
 * The demo-data reset button is available when explicitly enabled, and also
 * whenever the app is running off the bundled database - in that mode there is
 * nothing to protect and a reviewer may well want a clean slate.
 */
export function demoModeEnabled(): boolean {
  return process.env.DEMO_MODE === "true" || usingBundledDemoDb();
}
