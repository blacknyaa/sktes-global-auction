import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { readDatabaseUrl } from "./read-env.mjs";

/**
 * Gets the database ready during the build, whichever database that is.
 *
 * With a connection string configured, the schema is pushed and - only if the
 * database is completely empty - the demonstration data is written. Connecting
 * a database is then the whole job; nobody has to remember a follow-up command,
 * and a redeploy never disturbs data that is already there.
 *
 * With no connection string, a seeded SQLite file is baked into the build
 * instead, so an unconfigured deployment still demonstrates the system rather
 * than showing an error page. See src/lib/prisma.ts for how it is used.
 *
 * A failure here warns but does not fail the build: the deployment still comes
 * up and /api/health explains what is wrong, which is more useful than a red
 * build with no running site to inspect.
 */

const prismaCli = path.join("node_modules", "prisma", "build", "index.js");

function run(label, args, env) {
  console.log(`[provision] ${label}`);
  execFileSync(process.execPath, args, {
    env,
    stdio: ["ignore", "inherit", "inherit"],
  });
}

const found = readDatabaseUrl();

try {
  if (found) {
    // --- a real database is configured -------------------------------------
    console.log(`[provision] using ${found.name}`);
    const env = { ...process.env, DATABASE_URL: found.value };

    run("creating or updating the schema", [
      prismaCli,
      "db",
      "push",
      "--skip-generate",
      "--accept-data-loss",
    ], env);

    run("seeding if the database is empty", [
      "--import",
      "tsx",
      path.join("scripts", "seed-if-empty.ts"),
    ], env);

    console.log("[provision] database ready.");
  } else {
    // --- nothing configured: bundle a demo database ------------------------
    console.log(
      "[provision] no connection string found; bundling a demo database."
    );
    const dbPath = path.join(process.cwd(), "prisma", "demo.db");
    for (const suffix of ["", "-journal", "-wal", "-shm"]) {
      const f = `${dbPath}${suffix}`;
      if (existsSync(f)) rmSync(f);
    }
    const env = {
      ...process.env,
      DATABASE_URL: `file:${dbPath}?connection_limit=1`,
    };

    run("creating the schema", [
      prismaCli,
      "db",
      "push",
      "--skip-generate",
      "--accept-data-loss",
    ], env);
    run("seeding demonstration data", [
      "--import",
      "tsx",
      path.join("prisma", "seed", "index.ts"),
    ], env);

    console.log(`[provision] bundled database ready at ${dbPath}`);
  }
} catch (e) {
  console.error(
    "[provision] could not prepare the database:",
    e instanceof Error ? e.message : e
  );
  console.error(
    "[provision] the build continues; open /api/health on the deployment to see why."
  );
}
