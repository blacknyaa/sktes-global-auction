import { chromium } from "playwright";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
  deviceScaleFactor: 1,
});
await ctx.addCookies([{ name: "sktes_locale", value: "ja", url: BASE }]);
const page = await ctx.newPage();

const failed = [];
page.on("response", (r) => {
  if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(BASE, "")}`);
});

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const height = await page.evaluate(() => document.body.scrollHeight);
console.log("page height:", height, "px");
console.log("failed requests:", failed.length ? failed.slice(0, 8).join(" | ") : "none");

// weight of everything the browser actually downloaded
const weight = await page.evaluate(() =>
  performance
    .getEntriesByType("resource")
    .reduce((a, r) => a + (r.transferSize || 0), 0)
);
console.log("transferred:", (weight / 1024 / 1024).toFixed(2), "MB");

const imgs = await page.evaluate(() =>
  performance
    .getEntriesByType("resource")
    .filter((r) => r.initiatorType === "img")
    .map((r) => ({ n: r.name.split("/").pop(), kb: Math.round((r.transferSize || 0) / 1024) }))
    .sort((a, b) => b.kb - a.kb)
    .slice(0, 8)
);
console.log("heaviest images:", JSON.stringify(imgs));

await page.screenshot({ path: path.join("screenshots", "v-landing-full.png"), fullPage: true });
await page.screenshot({ path: path.join("screenshots", "v-landing-fold.png") });

await browser.close();
