import { copyFileSync, existsSync, statSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import {
  BUNDLED_DEMO_DB,
  RUNTIME_DEMO_DB,
  bundledDemoDbExists,
  hasDatabaseUrl,
  resolveDatabaseUrl,
  usingFallbackSecrets,
} from "./runtime";

/**
 * SQLite takes a single writer at a time. Prisma opens a pool sized to the
 * machine, so a server action that writes and then re-renders the page - which
 * is every action in this app - can end up waiting on a lock held by its own
 * request. The response stream then never closes and the button spins forever
 * with no error anywhere: 200 on the wire, nothing in the log.
 *
 * Serialising on one connection removes the contention entirely and costs
 * nothing at this scale. Postgres has no such limit, so the clamp only applies
 * to a file-backed datasource.
 */
function clampSqlitePool(url: string): string {
  if (!url.startsWith("file:") || url.includes("connection_limit=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
}

/**
 * A serverless host runs many short-lived instances, each with its own pool.
 * Against a connection pooler that multiplies quickly, so each instance keeps
 * a single connection and waits rather than opening more. `pgbouncer=true`
 * tells Prisma not to use prepared statements, which a transaction-mode pooler
 * cannot carry between queries.
 */
function tunePostgresPool(url: string): string {
  if (!url.startsWith("postgres")) return url;
  const sep = url.includes("?") ? "&" : "?";
  const additions = [];
  if (!url.includes("connection_limit=")) additions.push("connection_limit=1");
  if (!url.includes("pool_timeout=")) additions.push("pool_timeout=20");
  if (url.includes("-pooler") && !url.includes("pgbouncer=")) {
    additions.push("pgbouncer=true");
  }
  return additions.length ? `${url}${sep}${additions.join("&")}` : url;
}

/**
 * Errors that mean the query never reached the database, so running it again
 * cannot duplicate anything. A bid that vanishes because a connection was
 * briefly unavailable is the worst failure this system has, and it is silent:
 * the bidder sees no error and no bid. Anything ambiguous is deliberately left
 * out of this list.
 */
const RETRYABLE = new Set([
  "P2024", // timed out waiting for a connection from the pool
  "P1001", // cannot reach the database server
]);

async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await run();
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (!code || !RETRYABLE.has(code)) throw e;
      lastError = e;
      await new Promise((r) => setTimeout(r, 150 * 2 ** attempt));
    }
  }
  throw lastError;
}

/**
 * Copies the database that was seeded at build time into the one writable
 * directory a serverless host offers, so an unconfigured deployment is still a
 * working demonstration rather than an error page.
 *
 * The copy lives as long as the instance does. That is the honest limit of
 * running without a database: state is per-instance and resets when the
 * instance recycles. Setting DATABASE_URL to a Postgres connection string
 * replaces all of this and makes state permanent and shared.
 */
function bootstrapBundledDemoDb(): string {
  // Re-copy when the build is newer than the working copy, so a redeploy on a
  // still-warm instance does not keep serving the previous build's data.
  const stale =
    existsSync(RUNTIME_DEMO_DB) &&
    statSync(BUNDLED_DEMO_DB).mtimeMs > statSync(RUNTIME_DEMO_DB).mtimeMs;

  if (!existsSync(RUNTIME_DEMO_DB) || stale) {
    copyFileSync(BUNDLED_DEMO_DB, RUNTIME_DEMO_DB);
    console.warn(
      "[demo] No DATABASE_URL set. Running from the bundled demo database " +
        "copied to a temporary directory; changes last only as long as this " +
        "instance. Set DATABASE_URL to a PostgreSQL connection string for " +
        "persistent, shared state."
    );
  }
  return clampSqlitePool(`file:${RUNTIME_DEMO_DB}`);
}

function datasourceUrl(): string | undefined {
  const configured = resolveDatabaseUrl();
  if (configured) return tunePostgresPool(clampSqlitePool(configured));
  if (bundledDemoDbExists()) return bootstrapBundledDemoDb();
  return undefined;
}

if (!hasDatabaseUrl() && usingFallbackSecrets()) {
  console.warn(
    "[demo] Running with built-in demonstration secrets. Set SEAL_MASTER_KEY " +
      "and SESSION_SECRET before this carries anything real."
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: datasourceUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  }).$extends({
    query: {
      $allModels: {
        $allOperations: ({ args, query }) => withRetry(() => query(args)),
      },
    },
  }) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
