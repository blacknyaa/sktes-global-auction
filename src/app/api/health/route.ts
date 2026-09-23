import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  DATABASE_URL_CANDIDATES,
  bundledDemoDbExists,
  demoModeEnabled,
  hasDatabaseUrl,
  presentDatabaseUrlNames,
  resolveDatabaseUrl,
  usingBundledDemoDb,
  usingFallbackSecrets,
} from "@/lib/runtime";

export const dynamic = "force-dynamic";

/**
 * Deployment diagnostics.
 *
 * When a hosting platform answers with nothing but "a server-side exception
 * occurred" and a digest, there is no way to tell a missing environment
 * variable from an unreachable database from a schema that was never pushed.
 * This endpoint answers that question without anyone needing log access.
 *
 * It deliberately reports only booleans and a scrubbed error message. No
 * connection string, credential, host name or secret value ever leaves here -
 * see redact() below, which is applied to everything that comes back from the
 * driver.
 *
 * Everyone gets the verdict and the diagnosis. The rest - variable names,
 * value lengths, record counts, driver errors - maps out how the deployment is
 * wired, so it goes only to a signed-in administrator or to a caller holding
 * HEALTH_TOKEN. The token matters because the broken database that brings
 * someone here is usually also what stops the administrator signing in.
 */

/** Strips anything that could carry a credential or a host name. */
function redact(input: string): string {
  return input
    .replace(/[a-z]+:\/\/[^\s"']+/gi, "[connection string removed]")
    .replace(/\b[\w.-]+\.(?:tech|com|net|io|dev|cloud|app|org)\b/gi, "[host removed]")
    .replace(/\b(?:password|secret|key|token)\s*[:=]\s*\S+/gi, "$1=[removed]")
    .slice(0, 400);
}

function sameSecret(given: string, expected: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

async function mayReadDetails(req: Request): Promise<boolean> {
  // On the bundled demo database there is no configured infrastructure and
  // no data that is not already in the repository.
  if (usingBundledDemoDb()) return true;

  const expected = process.env.HEALTH_TOKEN?.trim();
  const given =
    req.headers.get("x-health-token") ?? new URL(req.url).searchParams.get("token");
  if (expected && given && sameSecret(given, expected)) return true;

  try {
    return (await getCurrentUser())?.role === "ADMIN";
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const dbUrl = resolveDatabaseUrl();
  const env = {
    DATABASE_URL: Boolean(dbUrl),
    // Which of the accepted variable names are actually set. Names only - a
    // connection string carries credentials and never leaves this process.
    connectionStringVariables: presentDatabaseUrlNames(),
    checkedVariableNames: [...DATABASE_URL_CANDIDATES],
    // Every variable name the runtime can see, so a database that was
    // connected under a name nobody expected still shows up. Names only -
    // no value is ever read here, and the platform's own build variables
    // are dropped because they are noise, not configuration.
    allVariableNames: Object.keys(process.env)
      .filter(
        (k) =>
          !/^(npm_|NEXT_RUNTIME|__NEXT|NODE|PATH$|PWD$|HOME$|HOSTNAME$|SHLVL$|_$)/.test(
            k
          )
      )
      .sort(),
    databaseKind: dbUrl?.startsWith("postgres")
      ? "postgresql"
      : dbUrl?.startsWith("file:")
        ? "sqlite"
        : "unset",
    SEAL_MASTER_KEY: /^[0-9a-f]{64}$/i.test(process.env.SEAL_MASTER_KEY ?? "")
      ? "ok"
      : process.env.SEAL_MASTER_KEY
        ? "present but not 64 hex characters"
        : "missing",
    SESSION_SECRET: Boolean(process.env.SESSION_SECRET),
    SITE_URL: Boolean(process.env.SITE_URL),
    DEMO_MODE: process.env.DEMO_MODE ?? null,
    // Length only, never content. A variable that exists with length 0 was
    // created in the dashboard but saved without a value, which looks
    // identical to "configured" from the outside and explains nothing on its
    // own. This is the one measurement that tells the two apart.
    valueLengths: Object.fromEntries(
      [
        "DATABASE_URL",
        "POSTGRES_PRISMA_URL",
        "POSTGRES_URL",
        "SEAL_MASTER_KEY",
        "SESSION_SECRET",
        "SITE_URL",
        "DEMO_MODE",
      ].map((k) => [
        k,
        k in process.env ? (process.env[k] ?? "").length : "not defined",
      ])
    ),
  };

  const build = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    region: process.env.VERCEL_REGION ?? null,
    nodeVersion: process.version,
  };

  // Two separate probes: can we talk to the database at all, and does the
  // schema actually exist with data in it? They fail for different reasons and
  // need different fixes.
  let connection: { ok: boolean; error?: string; errorName?: string } = { ok: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    connection = { ok: true };
  } catch (e) {
    const err = e as Error & { code?: string };
    connection = {
      ok: false,
      errorName: err.code ? `${err.name} (${err.code})` : err.name,
      error: redact(err.message ?? String(e)),
    };
  }

  let schema: {
    ok: boolean;
    counts?: Record<string, number>;
    error?: string;
    errorName?: string;
  } = { ok: false };
  if (connection.ok) {
    try {
      const [countries, companies, users, lots, bids] = await Promise.all([
        prisma.country.count(),
        prisma.company.count(),
        prisma.user.count(),
        prisma.lot.count(),
        prisma.bid.count(),
      ]);
      schema = {
        ok: countries > 0 && users > 0,
        counts: { countries, companies, users, lots, bids },
      };
    } catch (e) {
      const err = e as Error & { code?: string };
      schema = {
        ok: false,
        errorName: err.code ? `${err.name} (${err.code})` : err.name,
        error: redact(err.message ?? String(e)),
      };
    }
  }

  // SQLite is the right answer locally and the wrong answer on a serverless
  // host, so the verdict depends on where this is running.
  const onServerless = Boolean(process.env.VERCEL);
  const bundled = usingBundledDemoDb();

  const mode = {
    // Running from the database baked into the build, not a configured one.
    bundledDemoDatabase: bundled,
    bundledFilePresent: bundledDemoDbExists(),
    usingFallbackSecrets: usingFallbackSecrets(),
    demoResetAvailable: demoModeEnabled(),
    persistence: hasDatabaseUrl()
      ? "configured database (permanent, shared)"
      : bundled
        ? "per-instance temporary copy (resets when the instance recycles)"
        : "none",
  };

  // A name that exists with an empty value is the confusing case: the
  // dashboard shows the variable, so it looks configured, but nothing arrives.
  const definedButEmpty = Object.entries(env.valueLengths)
    .filter(([, v]) => v === 0)
    .map(([k]) => k);

  const diagnosis = definedButEmpty.length
    ? `環境変数 ${definedButEmpty.join(", ")} は登録されていますが、値が空です。Vercel の Settings → Environment Variables で値を入力し直し、Production にチェックを入れて保存してから Redeploy してください。`
    : !connection.ok
    ? !env.DATABASE_URL && !mode.bundledFilePresent
      ? "DATABASE_URL が未設定で、同梱のデモ用データベースも見つかりません。環境変数を設定して再デプロイしてください。"
      : "データベースに接続できません。接続文字列（pooled を選んでいるか）と、ホスト側でアクセスが許可されているかを確認してください。"
    : !schema.ok
      ? "接続はできていますが、表が無いかデータが空です。手元から `npm run db:deploy` を実行してください。"
      : bundled
        ? "同梱のデモ用データベースで動作中です。そのまま操作できますが、状態はインスタンス単位で、しばらく使われないと初期状態に戻ります。恒久的に保持するには DATABASE_URL に PostgreSQL の接続文字列を設定してください。"
        : onServerless && env.databaseKind === "sqlite"
          ? "DATABASE_URL が SQLite を指しています。サーバーレスでは動きません。PostgreSQL の接続文字列に変更してください。"
          : env.SEAL_MASTER_KEY !== "ok"
            ? "データベースは正常ですが、SEAL_MASTER_KEY が未設定か形式が誤っています（64桁の16進数）。"
            : !env.SESSION_SECRET
              ? "データベースは正常ですが、SESSION_SECRET が未設定です。ログインが維持できません。"
              : "問題は見つかりませんでした。";

  // The demo is usable as long as it can read and write its own data. Missing
  // secrets are a warning in demo mode and a failure once a real database is
  // configured, because at that point the data stops being disposable.
  const healthy =
    connection.ok &&
    schema.ok &&
    (bundled || (env.SEAL_MASTER_KEY === "ok" && Boolean(env.SESSION_SECRET)));

  const init = {
    status: healthy ? 200 : 503,
    headers: { "cache-control": "no-store" },
  };
  if (!(await mayReadDetails(req))) {
    return NextResponse.json(
      {
        healthy,
        diagnosis,
        details:
          "詳細は管理者でログインしてから開くか、環境変数 HEALTH_TOKEN の値を ?token= に付けて開いてください。",
      },
      init
    );
  }
  return NextResponse.json(
    { healthy, diagnosis, mode, env, build, connection, schema },
    init
  );
}
