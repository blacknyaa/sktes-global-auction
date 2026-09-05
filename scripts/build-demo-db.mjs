import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { readEnvVar } from "./read-env.mjs";

/**
 * Bakes a seeded SQLite database into the build when no database is configured.
 *
 * A deployment with no DATABASE_URL would otherwise be an error page, which
 * teaches a reviewer nothing about the system. With this, the same repository
 * deploys anywhere and works immediately: the file is copied into the writable
 * temp directory on first request (see src/lib/prisma.ts) and the demo runs.
 *
 * State then lives per instance and resets when the instance recycles - the
 * honest cost of running without a database. Setting DATABASE_URL to a
 * PostgreSQL connection string skips this entirely and gives permanent,
 * shared state.
 */

const configured = readEnvVar("DATABASE_URL");
if (configured) {
  console.log(
    "[demo-db] DATABASE_URL is set; skipping the bundled demo database."
  );
  process.exit(0);
}

const dbPath = path.join(process.cwd(), "prisma", "demo.db");
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  const f = `${dbPath}${suffix}`;
  if (existsSync(f)) rmSync(f);
}

const env = {
  ...process.env,
  DATABASE_URL: `file:${dbPath}?connection_limit=1`,
};

function run(label, file, args) {
  console.log(`[demo-db] ${label}`);
  execFileSync(file, args, { env, stdio: ["ignore", "inherit", "inherit"] });
}

try {
  run("creating schema", process.execPath, [
    path.join("node_modules", "prisma", "build", "index.js"),
    "db",
    "push",
    "--skip-generate",
    "--accept-data-loss",
  ]);
  run("seeding demonstration data", process.execPath, [
    "--import",
    "tsx",
    path.join("prisma", "seed", "index.ts"),
  ]);
  console.log(`[demo-db] bundled database ready at ${dbPath}`);
} catch (e) {
  console.error(
    "[demo-db] could not build the bundled database:",
    e instanceof Error ? e.message : e
  );
  console.error(
    "[demo-db] the build will continue; the deployment will need DATABASE_URL."
  );
}
