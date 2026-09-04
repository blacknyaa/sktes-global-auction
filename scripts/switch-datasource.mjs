import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Switches the Prisma datasource between sqlite and postgresql.
 *
 * The proposal claims moving to PostgreSQL is a one-line change. This script
 * is that claim being honest: the domain model uses no provider-specific
 * feature - no native enums, no arrays, no JSON columns - so the provider name
 * is genuinely the only thing that differs.
 *
 *   node scripts/switch-datasource.mjs postgresql
 *   node scripts/switch-datasource.mjs sqlite
 */

const target = process.argv[2];
if (!["sqlite", "postgresql"].includes(target)) {
  console.error("Usage: node scripts/switch-datasource.mjs <sqlite|postgresql>");
  process.exit(1);
}

const file = path.join(process.cwd(), "prisma", "schema.prisma");
const before = readFileSync(file, "utf8");
const after = before.replace(
  /(datasource db \{[\s\S]*?provider\s*=\s*)"(sqlite|postgresql)"/,
  `$1"${target}"`
);

if (before === after) {
  console.log(`Datasource already set to ${target}.`);
  process.exit(0);
}

writeFileSync(file, after);
console.log(`Datasource switched to ${target}.`);
console.log("Next:  npx prisma db push  &&  npm run db:seed");
