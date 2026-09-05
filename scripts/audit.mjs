import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Quality audit.
 *
 * e2e.mjs proves each screen renders and flow.mjs proves the business works.
 * This one asks the questions a reviewer asks without meaning to: is anything
 * untranslated, does anything throw in the console, is any link dead, does it
 * hold together on a phone, in dark mode, and is it fast enough to meet the
 * three-second response requirement in the brief.
 *
 *   node scripts/audit.mjs
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");
mkdirSync(OUT, { recursive: true });

/** The brief asks for a response within three seconds. */
const RESPONSE_BUDGET_MS = 3000;

const results = [];
function log(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();

async function newCtx(locale = "ja", viewport = { width: 1440, height: 900 }) {
  const c = await browser.newContext({
    viewport,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });
  await c.addCookies([{ name: "sktes_locale", value: locale, url: BASE }]);
  c.on("page", (p) => p.on("dialog", (d) => d.accept()));
  return c;
}

async function signIn(page, email, password = "Demo!2026") {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL(/\/(dashboard|login\/mfa)/, { timeout: 40000 }),
    page.click('button[type="submit"]'),
  ]);
}

/** Routes an administrator can reach, plus the public ones. */
const PUBLIC_ROUTES = ["/", "/login", "/register", "/guide", "/terms", "/forgot-password"];
const ADMIN_ROUTES = [
  "/dashboard",
  "/lots",
  "/contracts",
  "/admin/members",
  "/admin/fraud",
  "/admin/notifications",
  "/admin/audit",
  "/reports",
  "/admin/demo",
  "/settings/security",
];

// ---------------------------------------------------------------- 1. errors
{
  const c = await newCtx();
  const page = await c.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push(`${page.url()} :: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // A failed favicon or an aborted prefetch is noise, not a defect.
    if (/favicon|net::ERR_ABORTED/i.test(t)) return;
    problems.push(`${page.url()} :: ${t.slice(0, 160)}`);
  });

  await signIn(page, "admin@sktes-demo.com");
  for (const r of [...PUBLIC_ROUTES, ...ADMIN_ROUTES]) {
    await page.goto(BASE + r, { waitUntil: "networkidle" }).catch(() => {});
  }
  // one detail page of each kind
  for (const sel of ['a[href^="/lots/"]', 'a[href^="/admin/members/"]', 'a[href^="/contracts/"]']) {
    await page.goto(`${BASE}${sel.includes("lots") ? "/lots" : sel.includes("members") ? "/admin/members" : "/contracts"}`, { waitUntil: "networkidle" });
    const href = await page.locator(sel).first().getAttribute("href").catch(() => null);
    if (href) await page.goto(BASE + href, { waitUntil: "networkidle" });
  }

  log(
    "ブラウザに例外・エラーが出ない",
    problems.length === 0,
    problems.length ? problems.slice(0, 3).join(" | ") : `${PUBLIC_ROUTES.length + ADMIN_ROUTES.length + 3} pages`
  );
  await c.close();
}

// ------------------------------------------------------------ 2. translation
{
  // Untranslated screens are the classic failure of a bolted-on i18n layer.
  // The chrome (navigation, headings, buttons) must change language; the data
  // (company names, lot titles) legitimately stays as entered.
  const KANA = /[぀-ヿ]/; // hiragana or katakana

  for (const [locale, mustContain] of [
    ["en", "Dashboard"],
    ["zh", "仪表板"],
  ]) {
    const c = await newCtx(locale);
    const page = await c.newPage();
    await signIn(page, "admin@sktes-demo.com");

    const untranslated = [];
    for (const r of ADMIN_ROUTES) {
      await page.goto(BASE + r, { waitUntil: "networkidle" });
      // navigation labels are pure chrome and must never be Japanese here
      const navText = await page
        .locator("aside nav a, aside a")
        .allInnerTexts()
        .catch(() => []);
      for (const t of navText) {
        if (locale === "en" && KANA.test(t)) untranslated.push(`${r} nav: ${t}`);
      }
      // a raw dictionary key leaking into the page
      // Ignore spans deliberately showing a technical identifier to the operator.
      const body = await page.evaluate(() => {
        // innerText skips hidden nodes, so this leaves out the identifiers the
        // outbox shows an operator on purpose.
        document
          .querySelectorAll("[data-technical]")
          .forEach((e) => (e.style.display = "none"));
        return document.body.innerText;
      });
      if (/\b(common|nav|admin|lot|bid|member|contract)\.[a-zA-Z]+\b/.test(body)) {
        untranslated.push(`${r}: raw key visible`);
      }
    }

    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    const switched = (await page.locator(`text=${mustContain}`).count()) > 0;
    log(`${locale.toUpperCase()} 表示に切り替わる`, switched);
    log(
      `${locale.toUpperCase()} に未翻訳が残っていない`,
      untranslated.length === 0,
      untranslated.slice(0, 3).join(" | ")
    );

    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, `a-${locale}-dashboard.png`), fullPage: false });
    await c.close();
  }
}

// -------------------------------------------------------------- 3. dead links
{
  const c = await newCtx();
  const page = await c.newPage();
  await signIn(page, "admin@sktes-demo.com");

  const seen = new Set();
  const broken = [];
  for (const r of [...PUBLIC_ROUTES, ...ADMIN_ROUTES]) {
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((els) =>
        els
          .map((e) => e.getAttribute("href"))
          .filter((h) => h && h.startsWith("/") && !h.startsWith("//"))
      );
    for (const h of hrefs) seen.add(h.split("#")[0]);
  }

  for (const href of [...seen]) {
    const res = await page.request.get(BASE + href, { maxRedirects: 5 }).catch(() => null);
    const code = res?.status() ?? 0;
    // /denied is a legitimate destination; downloads answer 200 too
    if (code >= 400) broken.push(`${href} -> ${code}`);
  }
  log(
    "内部リンクに切れているものが無い",
    broken.length === 0,
    broken.length ? broken.slice(0, 4).join(" | ") : `${seen.size} links`
  );
  await c.close();
}

// -------------------------------------------------------------- 4. responsive
{
  const viewports = [
    { name: "phone", width: 390, height: 844 },
    { name: "tablet", width: 820, height: 1180 },
  ];
  for (const vp of viewports) {
    const c = await newCtx("ja", { width: vp.width, height: vp.height });
    const page = await c.newPage();
    await signIn(page, "admin@sktes-demo.com");

    const overflowing = [];
    for (const r of ["/dashboard", "/lots", "/admin/members", "/reports", "/admin/audit"]) {
      await page.goto(BASE + r, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      if (overflow > 2) overflowing.push(`${r} +${overflow}px`);
    }
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(OUT, `a-${vp.name}-dashboard.png`), fullPage: true });

    log(
      `${vp.name} で横スクロールが出ない`,
      overflowing.length === 0,
      overflowing.join(" | ")
    );
    await c.close();
  }
}

// -------------------------------------------------------------- 5. dark mode
{
  const c = await newCtx();
  const page = await c.newPage();
  await signIn(page, "admin@sktes-demo.com");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("sktes_theme", "dark");
  });
  await page.waitForTimeout(400);

  // Body text must not stay dark on a dark ground.
  const contrastOk = await page.evaluate(() => {
    const lum = (c) => {
      const m = c.match(/\d+/g)?.map(Number) ?? [255, 255, 255];
      const [r, g, b] = m.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const s = getComputedStyle(document.body);
    const a = lum(s.color);
    const b = lum(s.backgroundColor);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return ratio >= 4.5;
  });
  await page.screenshot({ path: path.join(OUT, "a-dark-dashboard.png"), fullPage: true });
  log("ダークモードの本文コントラストが基準を満たす", contrastOk);

  for (const r of ["/lots", "/admin/members"]) {
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(OUT, `a-dark${r.replace(/\//g, "-")}.png`),
      fullPage: true,
    });
  }
  await c.close();
}

// --------------------------------------------------------- 6. accessibility
{
  const c = await newCtx();
  const page = await c.newPage();
  await signIn(page, "admin@sktes-demo.com");

  const issues = [];
  for (const r of [...PUBLIC_ROUTES, ...ADMIN_ROUTES]) {
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    const found = await page.evaluate(() => {
      const out = [];
      const h1 = document.querySelectorAll("h1").length;
      if (h1 === 0) out.push("no h1");
      if (h1 > 1) out.push(`${h1} h1 elements`);

      document.querySelectorAll("input, select, textarea").forEach((el) => {
        if (el.type === "hidden") return;
        const id = el.getAttribute("id");
        const labelled =
          (id && document.querySelector(`label[for="${id}"]`)) ||
          el.closest("label") ||
          el.getAttribute("aria-label") ||
          el.getAttribute("placeholder") ||
          el.getAttribute("title");
        if (!labelled) out.push(`unlabelled ${el.tagName.toLowerCase()}[name=${el.getAttribute("name")}]`);
      });

      document.querySelectorAll("img").forEach((img) => {
        if (!img.hasAttribute("alt")) out.push("img without alt");
      });

      document.querySelectorAll("button").forEach((b) => {
        const name = (b.textContent ?? "").trim() || b.getAttribute("aria-label") || b.getAttribute("title");
        if (!name) out.push("button without an accessible name");
      });
      return out;
    });
    for (const f of found) issues.push(`${r}: ${f}`);
  }
  log(
    "アクセシビリティの基本を満たす",
    issues.length === 0,
    issues.length
      ? `${issues.length} issues:\n      ${issues.join("\n      ")}`
      : "labels, alt text, headings"
  );
  await c.close();
}

// ------------------------------------------------------------ 7. performance
{
  const c = await newCtx();
  const page = await c.newPage();
  await signIn(page, "admin@sktes-demo.com");

  const slow = [];
  const timings = [];
  for (const r of ADMIN_ROUTES) {
    // warm once, then measure, so the figure is not a cold compile
    await page.goto(BASE + r, { waitUntil: "networkidle" });
    const t0 = Date.now();
    await page.goto(BASE + r, { waitUntil: "domcontentloaded" });
    const ms = Date.now() - t0;
    timings.push(`${r} ${ms}ms`);
    if (ms > RESPONSE_BUDGET_MS) slow.push(`${r} ${ms}ms`);
  }
  const worst = timings
    .map((t) => Number(t.match(/(\d+)ms/)[1]))
    .sort((a, b) => b - a)[0];
  log(
    `全画面が応答時間3秒以内（最遅 ${worst}ms）`,
    slow.length === 0,
    slow.join(" | ")
  );
  await c.close();
}

// ------------------------------------------------------- 8. error pages
{
  const c = await newCtx();
  const page = await c.newPage();

  const notFound = await page.request.get(`${BASE}/this-page-does-not-exist`);
  log("存在しないURLは404を返す", notFound.status() === 404, `${notFound.status()}`);

  await signIn(page, "buyer@sktes-demo.com");
  await page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
  const denied =
    page.url().includes("/denied") && (await page.locator("h1").count()) > 0;
  await page.screenshot({ path: path.join(OUT, "a-denied.png") });
  log("権限外アクセスは専用画面に案内される", denied);

  const badLot = await page.request.get(`${BASE}/lots/does-not-exist`);
  log("存在しないロットは404を返す", badLot.status() === 404, `${badLot.status()}`);
  await c.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed.` +
    (failed.length ? `\n\nFailed:\n${failed.map((f) => `  - ${f.name} ${f.detail}`).join("\n")}` : "")
);
process.exit(failed.length ? 1 : 0);
