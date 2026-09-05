import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readDatabaseUrl } from "./read-env.mjs";

/**
 * Points the Prisma datasource at whatever DATABASE_URL actually is.
 *
 * The demo runs on SQLite locally and on PostgreSQL when deployed, and Prisma
 * cannot pick a provider at run time - it is baked into the generated client.
 * So the provider is derived from the connection string during the build,
 * which means one repository deploys to either without anybody remembering to
 * flip a switch. The model uses no provider-specific feature, so this really
 * is the only line that differs.
 */

const found = readDatabaseUrl();
const url = found?.value ?? "";
if (found) console.log(`[datasource] using ${found.name}`);
const target = url.startsWith("postgres") ? "postgresql" : "sqlite";

const file = path.join(process.cwd(), "prisma", "schema.prisma");
const before = readFileSync(file, "utf8");
const after = before.replace(
  /(datasource db \{[\s\S]*?provider\s*=\s*)"(sqlite|postgresql)"/,
  `$1"${target}"`
);

if (before === after) {
  console.log(`[datasource] already ${target}`);
} else {
  writeFileSync(file, after);
  console.log(`[datasource] switched to ${target}`);
}

if (!url) {
  console.warn(
    "[datasource] DATABASE_URL is not set; defaulting to sqlite. " +
      "On a hosting platform this almost always means the environment " +
      "variable was never added, and the app will fail at run time."
  );
}
