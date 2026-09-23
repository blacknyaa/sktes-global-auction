import { chromium } from "playwright";

/**
 * Puts the demo back to its opening position through the application itself.
 *
 * Useful after a verification run, or after someone has been clicking around
 * ahead of a review. It drives the administrator's own reset action rather
 * than touching the database directly, so it works against any deployment
 * without needing the connection string.
 *
 *   BASE_URL=https://... node scripts/reset-demo.mjs
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "ja-JP", timezoneId: "Asia/Tokyo" });
await ctx.addCookies([{ name: "sktes_locale", value: "ja", url: BASE }]);
ctx.on("page", (p) => p.on("dialog", (d) => d.accept()));
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="loginId"]', "admin");
await page.fill('input[name="password"]', "Demo!2026");
await Promise.all([page.waitForURL(/dashboard/), page.click('button[type="submit"]')]);

await page.goto(`${BASE}/admin/demo`, { waitUntil: "networkidle" });
await page.locator('button:has-text("初期状態に戻す")').first().click();
await page.waitForURL(/\/login/, { timeout: 180000 }).catch(() => {});

const health = await (await page.request.get(`${BASE}/api/health`)).json();
// Record counts are only in the detailed report, which needs a session or
// HEALTH_TOKEN; the reset has just signed us out.
console.log(
  "reset complete:",
  JSON.stringify(health.schema?.counts ?? { healthy: health.healthy })
);

await browser.close();
