import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
 * driver. Remove this route, or put it behind an allow-list, before the system
 * carries real trading data.
 */

/** Strips anything that could carry a credential or a host name. */
function redact(input: string): string {
  return input
    .replace(/[a-z]+:\/\/[^\s"']+/gi, "[connection string removed]")
    .replace(/\b[\w.-]+\.(?:tech|com|net|io|dev|cloud|app|org)\b/gi, "[host removed]")
    .replace(/\b(?:password|secret|key|token)\s*[:=]\s*\S+/gi, "$1=[removed]")
    .slice(0, 400);
}

export async function GET() {
  const env = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    databaseKind: process.env.DATABASE_URL?.startsWith("postgres")
      ? "postgresql"
      : process.env.DATABASE_URL?.startsWith("file:")
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

  const diagnosis = !env.DATABASE_URL
    ? "DATABASE_URL が設定されていません。Vercel の環境変数に追加してから再デプロイしてください。"
    : onServerless && env.databaseKind === "sqlite"
      ? "DATABASE_URL が SQLite を指しています。サーバーレスでは動きません。PostgreSQL の接続文字列に変更してください。"
      : !connection.ok
        ? "データベースに接続できません。接続文字列（pooled を選んでいるか）と、ホスト側でアクセスが許可されているかを確認してください。"
        : !schema.ok
          ? "接続はできていますが、表が無いかデータが空です。手元から `npm run db:deploy` を実行してください。"
          : env.SEAL_MASTER_KEY !== "ok"
            ? "データベースは正常ですが、SEAL_MASTER_KEY が未設定か形式が誤っています（64桁の16進数）。"
            : !env.SESSION_SECRET
              ? "データベースは正常ですが、SESSION_SECRET が未設定です。ログインが維持できません。"
              : "問題は見つかりませんでした。";

  const healthy =
    connection.ok &&
    schema.ok &&
    env.SEAL_MASTER_KEY === "ok" &&
    env.SESSION_SECRET &&
    !(onServerless && env.databaseKind === "sqlite");

  return NextResponse.json(
    { healthy, diagnosis, env, build, connection, schema },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } }
  );
}
