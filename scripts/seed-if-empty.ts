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
async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.count();
    if (users > 0) {
      console.log(
        `[provision] database already holds ${users} users; leaving it alone.`
      );
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
