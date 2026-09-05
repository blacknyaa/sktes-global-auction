import { chromium } from "playwright";

/**
 * Does a session survive on the deployed demo, and are consecutive requests
 * served by the same instance?
 */

const BASE = process.env.BASE_URL ?? "https://sktes-global-auction.vercel.app";
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: "ja-JP", timezoneId: "Asia/Tokyo" });
await ctx.addCookies([{ name: "sktes_locale", value: "ja", url: BASE }]);
const page = await ctx.newPage();

const seen = new Set();
page.on("response", (r) => {
  const id = r.headers()["x-vercel-id"];
  if (id) {
    // the trailing segment identifies the lambda that served it
    const inst = id.split("::").pop()?.slice(0, 12) ?? id;
    seen.add(inst);
  }
});

async function cookieNames() {
  return (await ctx.cookies(BASE)).map((c) => c.name).join(", ") || "(none)";
}

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
console.log("1. /login loaded. cookies:", await cookieNames());

await page.fill('input[name="email"]', "admin@sktes-demo.com");
await page.fill('input[name="password"]', "Demo!2026");
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
console.log("2. after submit. url:", page.url());
console.log("   cookies:", await cookieNames());

for (let i = 0; i < 3; i++) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  console.log(`3.${i + 1} /dashboard -> ${page.url().replace(BASE, "")}`);
}

console.log("\ndistinct instances that served this run:", seen.size);
console.log([...seen].join("\n"));

const health = await (await page.request.get(`${BASE}/api/health`)).json();
console.log("\nusers in this instance's database:", health.schema?.counts?.users);

await browser.close();
