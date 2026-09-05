import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * End-to-end smoke run. Drives a real browser through the demo the same way
 * the client will, and drops a screenshot of every screen into ./screenshots.
 *
 *   node scripts/e2e.mjs               full run
 *   node scripts/e2e.mjs --only=admin  one section
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");
mkdirSync(OUT, { recursive: true });

const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
const results = [];

function log(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function shot(page, name) {
  // Sticky headers get painted twice in a full-page capture; drop them first.
  const style = await page.addStyleTag({
    content: "*{position:static !important}",
  });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  await style.evaluate((el) => el.remove()).catch(() => {});
}

/** Waits for every submit button to stop reporting aria-busy. */
async function settle(page, timeout = 30000) {
  await page
    .waitForFunction(
      () => !document.querySelector('button[aria-busy="true"]'),
      undefined,
      { timeout, polling: 100 }
    )
    .catch(() => {});
  await page.waitForTimeout(300);
}

/** Clicks, waits for the pending state to appear, then for it to clear. */
async function act(page, locator) {
  await locator.click();
  await page
    .waitForFunction(
      () => !!document.querySelector('button[aria-busy="true"]'),
      undefined,
      { timeout: 3000, polling: 50 }
    )
    .catch(() => {});
  await settle(page);
}

async function login(page, email, password = "Demo!2026") {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL(/\/(dashboard|login\/mfa)/, { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function logout(page) {
  const btn = page.locator('form button:has-text("ログアウト")').first();
  if (await btn.count()) {
    await Promise.all([page.waitForURL(/\/login/, { timeout: 30000 }), btn.click()]);
  }
}

/** Visits a page and asserts it rendered without falling back to the login screen. */
async function visit(page, url, label, needle) {
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  const ok =
    !page.url().includes("/login") &&
    (!needle || (await page.locator(`text=${needle}`).count()) > 0);
  log(label, ok, ok ? "" : `at ${page.url()}`);
  return ok;
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
});
await context.addCookies([{ name: "sktes_locale", value: "ja", url: BASE }]);
const page = await context.newPage();
// Confirmation dialogs are part of the product now; accept them like a user would.
context.on("page", (p) => p.on("dialog", (d) => d.accept()));
page.on("dialog", (d) => d.accept());
page.on("pageerror", (e) => console.log("  [page error]", e.message));

try {
  // ---------------------------------------------------------------- public
  if (!only || only === "public") {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await shot(page, "01-landing");
    log("landing renders", (await page.locator("h1").count()) > 0);
    log("sealed ciphertext visible", (await page.locator("text=ENCRYPTED").count()) > 0);

    await page.goto(`${BASE}/register`, { waitUntil: "domcontentloaded" });
    await shot(page, "02-register");
    log("register wizard", (await page.locator('input[name="companyName"]').count()) > 0);

    await page.goto(`${BASE}/guide`, { waitUntil: "networkidle" });
    await shot(page, "22-guide");
    log("guide page", (await page.locator("text=ご利用ガイド").count()) > 0);

    await page.goto(`${BASE}/terms`, { waitUntil: "networkidle" });
    log("terms page", (await page.locator("text=第1条").count()) > 0);

    const robots = await page.request.get(`${BASE}/robots.txt`);
    log("robots.txt", robots.ok() && (await robots.text()).includes("Sitemap"));
    const sitemap = await page.request.get(`${BASE}/sitemap.xml`);
    log("sitemap.xml", sitemap.ok() && (await sitemap.text()).includes("<urlset"));

    // language switch must actually change the copy
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.locator('button:has-text("EN")').first().click();
    const switched = await page
      .waitForSelector("text=sold by sealed bid", { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    log("locale switch", switched);
    await page.locator('button:has-text("日本語")').first().click();
    await page.waitForSelector("text=封印入札", { timeout: 20000 }).catch(() => {});

    // responsive pass
    const mobile = await context.newPage();
    await mobile.setViewportSize({ width: 390, height: 844 });
    await mobile.goto(BASE, { waitUntil: "networkidle" });
    const overflow = await mobile.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    await mobile.screenshot({
      path: path.join(OUT, "23-mobile-landing.png"),
      fullPage: true,
    });
    log("no horizontal overflow on mobile", overflow <= 1, `${overflow}px`);
    await mobile.close();
  }

  // ----------------------------------------------------------------- admin
  if (!only || only === "admin") {
    await login(page, "admin@sktes-demo.com");
    log("admin signed in", page.url().includes("/dashboard"));
    await page.waitForTimeout(800);
    await shot(page, "03-admin-dashboard");
    log("dashboard charts", (await page.locator("svg[role='img']").count()) > 0);

    await visit(page, "/admin/members", "member list", "会員管理");
    await shot(page, "04-admin-members");
    const rows = await page.locator("table tbody tr").count();
    log("member list rows", rows > 0, `${rows} rows`);

    const first = page.locator('table tbody a[href^="/admin/members/"]').first();
    if (await first.count()) {
      const href = await first.getAttribute("href");
      await page.goto(BASE + href, { waitUntil: "networkidle" });
      await shot(page, "05-admin-member-detail");
      log("member detail", (await page.locator("text=提出書類").count()) > 0);

      // A seeded document must be openable, not just listed. Files live in the
      // database now, so this also proves storage survives a serverless host.
      const docHref = await page
        .locator('a[href^="/api/documents/"]')
        .first()
        .getAttribute("href")
        .catch(() => null);
      if (docHref) {
        const res = await page.request.get(BASE + docHref);
        const body = await res.body();
        log(
          "seeded document opens",
          res.ok() && body.subarray(0, 4).toString() === "%PDF",
          `${res.status()} ${body.length}B`
        );
      } else {
        log("seeded document opens", false, "no document link");
      }
    } else {
      log("member detail", false, "no link found");
    }

    await page.goto(`${BASE}/settings/security`, { waitUntil: "networkidle" });
    if (!(await page.locator('img[alt="MFA QR code"]').count())) {
      const enable = page.locator('[data-testid=begin-mfa]').first();
      if (await enable.count()) await act(page, enable);
      await page
        .waitForSelector('img[alt="MFA QR code"]', { timeout: 30000 })
        .catch(() => {});
    }
    await shot(page, "06-mfa-setup");
    log("MFA QR rendered", (await page.locator('img[alt="MFA QR code"]').count()) > 0);

    await visit(page, "/admin/audit", "audit log", "監査ログ");
    await shot(page, "12-audit");
    log("audit rows", (await page.locator("table tbody tr").count()) > 0);

    await visit(page, "/admin/notifications", "notification outbox", "通知アウトボックス");
    await shot(page, "13-notifications");

    await visit(page, "/admin/fraud", "fraud monitoring", "不正監視");
    await shot(page, "14-fraud");

    await visit(page, "/reports", "admin reports", "レポート");
    await shot(page, "15-reports");

    await visit(page, "/contracts", "contract list", "成約管理");
    const contractLink = page.locator('table tbody a[href^="/contracts/"]').first();
    if (await contractLink.count()) {
      const href = await contractLink.getAttribute("href");
      await page.goto(BASE + href, { waitUntil: "networkidle" });
      await shot(page, "16-contract-detail");
      log("contract detail", (await page.locator("text=請求書").count()) > 0);

      const invoiceLink = page.locator('a[href^="/invoice/"]').first();
      if (await invoiceLink.count()) {
        const inv = await invoiceLink.getAttribute("href");
        await page.goto(BASE + inv, { waitUntil: "networkidle" });
        await shot(page, "17-invoice");
        log("printable invoice", (await page.locator("table").count()) > 0);
      }
    } else {
      log("contract detail", false, "no contract rows");
    }

    // a closed lot should offer the opening ceremony
    await page.goto(`${BASE}/lots?status=CLOSED`, { waitUntil: "networkidle" });
    const closed = page.locator('a[href^="/lots/"]').first();
    if (await closed.count()) {
      const href = await closed.getAttribute("href");
      await page.goto(BASE + href, { waitUntil: "networkidle" });
      const hasOpen =
        (await page.locator('button:has-text("封印を解除")').count()) > 0 ||
        (await page.locator("text=開封済").count()) > 0;
      await shot(page, "18-closed-lot");
      log("seal ceremony available on closed lot", hasOpen);
    }

    await logout(page);
  }

  // ---------------------------------------------------------------- bidder
  if (!only || only === "bidder") {
    await login(page, "buyer@sktes-demo.com");
    log("bidder signed in", page.url().includes("/dashboard"));
    await page.waitForTimeout(600);
    await shot(page, "07-bidder-dashboard");

    await visit(page, "/lots", "lot list", "出品一覧");
    await shot(page, "08-lots");

    // spec-level search is the differentiator - prove it filters
    await page.goto(`${BASE}/lots?maker=Dell&minRam=16`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await shot(page, "08b-spec-search");
    log(
      "spec search returns matches",
      (await page.locator("text=一致した明細").count()) > 0
    );

    await page.goto(`${BASE}/lots?status=OPEN&sort=quantity`, { waitUntil: "networkidle" });
    const target = page.locator('a[href^="/lots/"]').first();
    if (await target.count()) {
      const href = await target.getAttribute("href");
      await page.goto(BASE + href, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      await shot(page, "09-lot-detail");
      log("lot detail", (await page.locator("text=ロット明細").count()) > 0);
      log("manifest table rendered", (await page.locator("table tbody tr").count()) > 0);

      const amountField = page.locator('input[name="amount"]');
      if (await amountField.count()) {
        const min = Number((await amountField.getAttribute("min")) ?? "0");
        await amountField.fill(String(Math.ceil(min * 1.15) + 1));
        await page
          .locator('form:has(input[name="amount"]) button[type="submit"]')
          .first()
          .click();
        await page
          .waitForSelector("text=入札を受け付けました", { timeout: 20000 })
          .catch(() => {});
        await page.waitForTimeout(400);
        await shot(page, "09b-bid-placed");
        log(
          "sealed bid accepted",
          (await page.locator("text=改ざん検知ハッシュ").count()) > 0
        );
      } else {
        log("sealed bid accepted", false, "no bid panel");
      }
    }

    await visit(page, "/bids", "bid history", "入札履歴");
    await shot(page, "10-bids");
    await visit(page, "/contracts", "bidder contracts", "成約管理");
    await visit(page, "/reports", "bidder reports", "レポート");
    await shot(page, "11-bidder-reports");

    await logout(page);
  }

  // ---------------------------------------------------------------- seller
  if (!only || only === "seller") {
    await login(page, "seller@sktes-demo.com");
    log("seller signed in", page.url().includes("/dashboard"));
    await page.waitForTimeout(600);
    await shot(page, "19-seller-dashboard");

    await visit(page, "/listings", "seller listings", "出品管理");
    await shot(page, "20-seller-listings");

    await visit(page, "/listings/new", "new listing wizard", "新規出品");
    await shot(page, "21-new-listing");
    log(
      "excel template link",
      (await page.locator('a[href="/api/manifest-template"]').count()) > 0
    );

    // the template must actually download and be a real workbook
    const res = await page.request.get(`${BASE}/api/manifest-template`);
    const body = await res.body();
    log(
      "excel template downloads",
      res.ok() && body.length > 4000 && body[0] === 0x50 && body[1] === 0x4b,
      `${res.status()} ${body.length} bytes`
    );
  }
} catch (err) {
  log("run", false, err.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed. Screenshots in ./screenshots`
);
process.exit(failed.length > 0 ? 1 : 0);
