import { PrismaClient } from "@prisma/client";
import {
  RESET_REQUESTS_PER_WINDOW,
  createPasswordResetToken,
} from "../src/lib/auth";

/**
 * Forgot-password requests for one account must stay under the hourly ceiling
 * even when several arrive at once (#64).
 *
 * Run: npm run verify:reset-rate
 */

const prisma = new PrismaClient();
let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const loginId = `reset-rate-${Date.now()}`;
  const user = await prisma.user.create({
    data: {
      email: `${loginId}@example.com`,
      loginId,
      passwordHash: "x",
      name: "reset-rate",
      role: "BIDDER",
    },
  });

  try {
    console.log("\n=== concurrent requests at an empty window ===\n");
    const burst = RESET_REQUESTS_PER_WINDOW + 3;
    const results = await Promise.all(
      Array.from({ length: burst }, () => createPasswordResetToken(user.id))
    );
    const issued = results.filter((t) => t != null).length;
    check(
      `at most ${RESET_REQUESTS_PER_WINDOW} tokens are issued`,
      issued === RESET_REQUESTS_PER_WINDOW,
      `issued ${issued} of ${burst}`
    );

    const stored = await prisma.passwordResetToken.count({
      where: { userId: user.id },
    });
    check(
      "stored rows match the issued count",
      stored === RESET_REQUESTS_PER_WINDOW,
      `stored ${stored}`
    );

    console.log("\n=== another request once the window is full ===\n");
    check(
      "a further request is refused",
      (await createPasswordResetToken(user.id)) === null
    );
  } finally {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    await prisma.$disconnect();
  }

  if (failures) {
    console.log(`\n${failures} check(s) failed\n`);
    process.exit(1);
  }
  console.log("\nall reset-rate checks passed\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
