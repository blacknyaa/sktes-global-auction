import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Reads a variable from the shell first, then from a local .env file.
 *
 * The build scripts run before Next.js loads .env, so without this a developer
 * whose .env points at PostgreSQL would get a build prepared for SQLite. On a
 * hosting platform there is no .env and only the shell matters, which is the
 * same code path.
 */
export function readEnvVar(name) {
  const fromShell = process.env[name]?.trim();
  if (fromShell) return fromShell;

  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return undefined;

  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    if (line.slice(0, eq).trim() !== name) continue;
    return line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return undefined;
}
