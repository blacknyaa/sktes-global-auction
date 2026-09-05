import { PrismaClient } from "@prisma/client";

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
function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("file:")) return url;
  if (url.includes("connection_limit=")) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: datasourceUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
