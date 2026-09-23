import { PrismaClient } from "@prisma/client";
import { claimTotpStep } from "../src/lib/auth";
import { generateTotpSecret, matchTotpStep, totpCode } from "../src/lib/totp";

/**
 * A TOTP code must sign someone in at most once (#34).
 *
 * Run: npm run verify:totp-replay
 */

const prisma = new PrismaClient();
let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const secret = generateTotpSecret();
  const loginId = `totp-replay-${Date.now()}`;
  const user = await prisma.user.create({
    data: {
      email: `${loginId}@example.com`,
      loginId,
      passwordHash: "x",
      name: "totp-replay",
      role: "BIDDER",
      mfaEnabled: true,
      mfaSecret: secret,
    },
  });

  try {
    const now = new Date();
    const code = totpCode(secret, now);
    const step = matchTotpStep(secret, code, now);
    check("current code matches a step", step !== null);

    console.log("\n=== reuse within the acceptance window ===\n");
    check("first use accepted", await claimTotpStep(user.id, step!));
    check("same step refused", !(await claimTotpStep(user.id, step!)));
    check("older step refused", !(await claimTotpStep(user.id, step! - 1)));

    console.log("\n=== two uses of the next step at once ===\n");
    const next = step! + 1;
    const raced = await Promise.all([
      claimTotpStep(user.id, next),
      claimTotpStep(user.id, next),
    ]);
    check(
      "exactly one of two simultaneous claims wins",
      raced.filter(Boolean).length === 1,
      String(raced)
    );
    check("a later step still works", await claimTotpStep(user.id, step! + 2));
  } finally {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    await prisma.$disconnect();
  }

  if (failures) {
    console.log(`\n${failures} check(s) failed\n`);
    process.exit(1);
  }
  console.log("\nall totp-replay checks passed\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
