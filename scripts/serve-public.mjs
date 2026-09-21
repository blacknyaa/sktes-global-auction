import { spawn } from "node:child_process";
import { writeFileSync, appendFileSync } from "node:fs";
import path from "node:path";

/**
 * Keeps the demo published on a public URL, unattended.
 *
 * Two processes have to stay up: the application server and the tunnel that
 * exposes it. Either can drop - a tunnel is a long-lived connection over the
 * public internet - and when one does, the URL stops working with nothing to
 * show for it. This supervises both, restarts whichever died, and writes the
 * current address to PUBLIC_URL.txt so it can always be looked up.
 *
 *   node scripts/serve-public.mjs
 */

const ROOT = process.cwd();
const URL_FILE = path.join(ROOT, "PUBLIC_URL.txt");
const LOG_FILE = path.join(ROOT, ".tmp-test", "serve-public.log");

let appProc = null;
let tunnelProc = null;
let currentUrl = null;
let stopping = false;

function log(line) {
  const stamped = `${new Date().toISOString()}  ${line}`;
  console.log(stamped);
  try {
    appendFileSync(LOG_FILE, stamped + "\n");
  } catch {
    /* the log is a convenience, never a reason to stop serving */
  }
}

function publishUrl(url) {
  currentUrl = url;
  writeFileSync(
    URL_FILE,
    `${url}\n\n` +
      `SK TES Global Auction - 公開URL\n` +
      `発行時刻: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}\n\n` +
      `ログイン:\n` +
      `  admin    管理者\n` +
      `  seller   出品者\n` +
      `  buyer    応札者\n` +
      `  パスワードは共通で Demo!2026\n\n` +
      `このURLはトンネルが張り直されると変わります。\n` +
      `常に最新の値がこのファイルに書かれています。\n`
  );
  log(`public URL: ${url}`);
}

function startApp() {
  log("starting the application server");
  appProc = spawn(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["start"],
    { cwd: ROOT, shell: process.platform === "win32" }
  );
  appProc.stdout.on("data", () => {});
  appProc.stderr.on("data", () => {});
  appProc.on("exit", (code) => {
    if (stopping) return;
    log(`application server exited (${code}); restarting in 3s`);
    appProc = null;
    setTimeout(startApp, 3000);
  });
}

function startTunnel() {
  log("opening the tunnel");
  tunnelProc = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", "cloudflared@latest", "tunnel", "--url", "http://localhost:3000"],
    { cwd: ROOT, shell: process.platform === "win32" }
  );

  const scan = (chunk) => {
    const m = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && m[0] !== currentUrl) publishUrl(m[0]);
  };
  tunnelProc.stdout.on("data", scan);
  tunnelProc.stderr.on("data", scan);

  tunnelProc.on("exit", (code) => {
    if (stopping) return;
    log(`tunnel exited (${code}); reopening in 5s`);
    tunnelProc = null;
    currentUrl = null;
    setTimeout(startTunnel, 5000);
  });
}

/** Confirms the site actually answers, and reopens the tunnel if it does not. */
async function watch() {
  if (stopping || !currentUrl) return;
  try {
    const res = await fetch(`${currentUrl}/api/health`, {
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok && res.status !== 503) throw new Error(`status ${res.status}`);
  } catch (e) {
    log(`health check failed (${e instanceof Error ? e.message : e}); reopening the tunnel`);
    tunnelProc?.kill();
  }
}

process.on("SIGINT", () => {
  stopping = true;
  appProc?.kill();
  tunnelProc?.kill();
  process.exit(0);
});

startApp();
setTimeout(startTunnel, 6000);
setInterval(watch, 60000);
