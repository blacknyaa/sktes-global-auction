import { PrismaClient } from "@prisma/client";
import { runSeed } from "../prisma/seed/index";

/**
 * Seeds a configured database, but only when it is empty.
 *
 * This runs during the build so that connecting a database is the only thing
 * anybody has to do: the schema is pushed and the demonstration data appears
 * on its own. Seeding wipes before it writes, so it must never touch a
 * database that already holds anything - hence the count check rather than a
 * flag someone has to remember to unset.
 */
/**
 * Accounts created before login IDs existed get one derived from the address
 * they were signing in with, following the same convention the seed uses:
 * the part before the @ with dots turned into hyphens. Nothing else is
 * touched, and a name that is somehow already taken gets a numeric suffix.
 */
async function backfillLoginIds(prisma: PrismaClient) {
  const missing = await prisma.user.findMany({
    where: { loginId: null },
    select: { id: true, email: true },
  });
  if (missing.length === 0) return;

  let done = 0;
  for (const u of missing) {
    const base = u.email
      .split("@")[0]
      .toLowerCase()
      .replace(/\./g, "-")
      .replace(/[^a-z0-9_-]/g, "-");
    for (let n = 0; n < 50; n++) {
      const candidate = n === 0 ? base : `${base}${n + 1}`;
      try {
        await prisma.user.update({ where: { id: u.id }, data: { loginId: candidate } });
        done++;
        break;
      } catch {
        /* taken; try the next suffix */
      }
    }
  }
  console.log(`[provision] gave login IDs to ${done} of ${missing.length} existing users.`);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.count();
    if (users > 0) {
      console.log(
        `[provision] database already holds ${users} users; leaving it alone.`
      );
      await backfillLoginIds(prisma);
      return;
    }
    console.log("[provision] database is empty; seeding demonstration data...");
    await prisma.$disconnect();
    await runSeed();
    console.log("[provision] seeding finished.");
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error("[provision] seeding failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
