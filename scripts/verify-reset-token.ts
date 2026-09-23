import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import { consumePasswordResetToken, verifyPassword } from "../src/lib/auth";

/**
 * A password reset link must work exactly once.
 *
 * Checking the token and then marking it used are two writes, and two requests
 * carrying the same link can both pass the check before either marks it. Both
 * then set a password, and the one that finishes last decides what it becomes
 * - so an attacker who sees the link once can sit on it and win that race.
 *
 * This proves the token is claimed in a single conditional write, that a used
 * link is refused, and that an expired one never opens.
 *
 * Run: npm run verify:reset-token
 */

const prisma = new PrismaClient();
let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
}

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

async function issue(userId: string, minutesValid: number) {
  const token = randomBytes(24).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + minutesValid * 60_000),
    },
  });
  return token;
}

async function main() {
  const user = await prisma.user.findFirst({ where: { loginId: { not: null } } });
  if (!user) {
    console.log("no users seeded; nothing to check");
    return;
  }
  const original = user.passwordHash;

  try {
    console.log("\n=== 1. The same link used twice at once ===\n");
    {
      const token = await issue(user.id, 30);
      const [first, second] = await Promise.all([
        consumePasswordResetToken(token, "RaceOne2026"),
        consumePasswordResetToken(token, "RaceTwo2026"),
      ]);
      const accepted = [first, second].filter(Boolean).length;
      check("only one of two simultaneous requests is accepted", accepted === 1, `accepted ${accepted} of 2`);

      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      const isOne = await verifyPassword("RaceOne2026", after.passwordHash);
      const isTwo = await verifyPassword("RaceTwo2026", after.passwordHash);
      check(
        "the password is the winner's, not whichever finished last",
        (first && isOne && !isTwo) || (second && isTwo && !isOne),
        `RaceOne=${isOne} RaceTwo=${isTwo}`
      );
      check("the link is refused afterwards", (await consumePasswordResetToken(token, "Later2026")) === false);
    }

    console.log("\n=== 2. A link past its expiry ===\n");
    {
      const token = await issue(user.id, 30);
      await prisma.passwordResetToken.updateMany({
        where: { tokenHash: sha256(token) },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      check("an expired link never opens", (await consumePasswordResetToken(token, "Expired2026")) === false);
    }

    console.log("\n=== 3. A link nobody issued ===\n");
    check(
      "an unknown token is refused",
      (await consumePasswordResetToken(randomBytes(24).toString("hex"), "Unknown2026")) === false
    );
  } finally {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: original } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  }

  console.log(
    `\n${failures === 0 ? "Reset links are single-use." : `${failures} check(s) failed.`}\n`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(failures > 0 ? 1 : 0);
  });
