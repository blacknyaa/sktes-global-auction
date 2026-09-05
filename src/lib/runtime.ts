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

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
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
