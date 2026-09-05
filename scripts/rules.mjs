import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

/**
 * Business-rule checks.
 *
 * flow.mjs walks the happy path from registration to delivery. This one goes
 * after the rules that decide whether the system is trustworthy rather than
 * merely working: does the Excel import really build a lot, is the card
 * ceiling actually enforced, does a Japanese buyer get a qualified invoice
 * while an overseas buyer gets an export-exempt one, does a bid arriving in
 * the closing minutes really extend the deadline.
 *
 *   node scripts/rules.mjs [--no-seed]
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");
const TMP = path.join(process.cwd(), ".tmp-test");
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const results = [];
function log(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
}
async function shot(page, name) {
  const style = await page.addStyleTag({ content: "*{position:static !important}" });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  await style.evaluate((el) => el.remove()).catch(() => {});
}

if (!process.argv.includes("--no-seed")) {
  console.log("reseeding demo data...\n");
  execFileSync(
    process.execPath,
    ["--env-file-if-exists=.env", "--import", "tsx", "prisma/seed/index.ts"],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
}

const browser = await chromium.launch();
const ctx = async () => {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });
  c.on("page", (p) => p.on("dialog", (d) => d.accept()));
  await c.addCookies([{ name: "sktes_locale", value: "ja", url: BASE }]);
  return c;
};

async function signIn(page, email, password = "Demo!2026") {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL(/\/(dashboard|login\/mfa)/, { timeout: 40000 }),
    page.click('button[type="submit"]'),
  ]);
}

async function settle(page, timeout = 30000) {
  await page
    .waitForFunction(() => !document.querySelector('button[aria-busy="true"]'), undefined, {
      timeout,
      polling: 100,
    })
    .catch(() => {});
  await page.waitForTimeout(400);
}
async function act(page, locator) {
  await locator.click();
  await page
    .waitForFunction(() => !!document.querySelector('button[aria-busy="true"]'), undefined, {
      timeout: 3000,
      polling: 50,
    })
    .catch(() => {});
  await settle(page);
}

const stamp = Date.now().toString().slice(-6);

/** Builds a manifest workbook the seller would realistically upload. */
async function manifestFile() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("manifest");
  ws.addRow(["メーカー", "型番", "CPU", "RAM(GB)", "ストレージ", "グレード", "数量"]);
  const rows = [
    ["Dell", "Latitude 5420", "Core i5-1135G7", 16, "SSD 256GB NVMe", "A", 40],
    ["HP", "EliteBook 840 G8", "Core i7-1165G7", 16, "SSD 512GB NVMe", "B", 35],
    ["Lenovo", "ThinkPad T14 Gen 2", "Ryzen 5 PRO 5650U", 8, "SSD 256GB", "B", 25],
    ["Apple", "MacBook Air M1 2020", "Apple M1", 8, "SSD 256GB", "A", 12],
  ];
  rows.forEach((r) => ws.addRow(r));
  const file = path.join(TMP, `manifest_${stamp}.xlsx`);
  await wb.xlsx.writeFile(file);
  return { file, units: rows.reduce((a, r) => a + r[6], 0), lines: rows.length };
}

try {
  // ============================================ 1. Excel import creates a lot
  let newLotHref = null;
  {
    const c = await ctx();
    const page = await c.newPage();
    await signIn(page, "seller@sktes-demo.com");
    const { file, units, lines } = await manifestFile();

    await page.goto(`${BASE}/listings/new`, { waitUntil: "networkidle" });
    await page.fill('input[name="title"]', `Excel取込テスト ${stamp}`);
    await page.fill('input[name="titleEn"]', `Excel import test ${stamp}`);
    await page.selectOption('select[name="categoryCode"]', "PC");
    await page.selectOption('select[name="condition"]', "USED_WORKING");
    await page.locator('button:visible:has-text("次へ")').first().click();

    await page.setInputFiles('input[name="manifest"]', file);
    await act(page, page.locator('button:visible:has-text("Excelファイルを選択")').first());

    const parsedOk = await page
      .waitForSelector(`text=${lines}`, { timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    const previewRows = await page.locator("table tbody tr").count();
    await shot(page, "r01-excel-parsed");
    log(
      "Excel明細を取り込んで内容を確認できる",
      parsedOk && previewRows === lines,
      `${previewRows} rows parsed`
    );

    // close within a few minutes so the soft-close rule can be exercised
    // far enough out that the whole run finishes before it closes, and inside
    // the extension trigger window so a late bid must push the deadline
    const closeAt = new Date(Date.now() + 20 * 60_000);
    // The form reads a datetime-local value in the seller own time zone,
    // which is the point of the deadline handling. This machine may sit in
    // another zone, so build the string in Tokyo time, not from the clock.
    const local = (d) =>
      new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
        .format(d)
        .replace(" ", "T");

    await page.locator('button:visible:has-text("次へ")').first().click();
    await page.fill('input[name="minimumBid"]', "1000");
    await page.fill('input[name="startAt"]', local(new Date(Date.now() - 60_000)));
    await page.fill('input[name="endAt"]', local(closeAt));
    await page.locator('input[name="auctionType"][value="OPEN"]').check();
    const ext = page.locator('input[name="extensionEnabled"]');
    if (await ext.count()) await ext.check().catch(() => {});
    await page.fill('input[name="extensionTriggerMin"]', "30");
    await act(page, page.locator('button:visible:has-text("公開する")').first());

    await page.goto(`${BASE}/listings`, { waitUntil: "networkidle" });
    const row = page.locator(`tr:has-text("${stamp}") a[href^="/lots/"]`).first();
    newLotHref = await row.getAttribute("href").catch(() => null);
    log("取り込んだ明細から出品が作られる", Boolean(newLotHref));

    if (newLotHref) {
      await page.goto(BASE + newLotHref, { waitUntil: "networkidle" });
      const shownUnits = (await page.locator("body").innerText()).includes(
        units.toLocaleString("ja-JP")
      );
      log("出品数がExcelの合計と一致する", shownUnits, `${units} units`);

      // the manifest must be searchable, which is the point of importing it
      await page.fill('input[placeholder="検索"]', "Ryzen");
      await page.waitForTimeout(600);
      const filtered = await page.locator("table tbody tr").count();
      log("取り込んだ明細をスペックで絞り込める", filtered === 1, `${filtered} row`);
    }
    await c.close();
  }

  // ================================================ 2. soft close extension
  if (newLotHref) {
    const c = await ctx();
    const page = await c.newPage();
    await signIn(page, "buyer@sktes-demo.com");
    await page.goto(BASE + newLotHref, { waitUntil: "networkidle" });

    const before = await page.locator("text=/自動延長/").count();
    const field = page.locator('input[name="amount"]');
    if ((await field.count()) && before > 0) {
      await field.fill("2000");
      await act(page, page.locator('form:has(input[name="amount"]) button[type="submit"]').first());
      await page.reload({ waitUntil: "networkidle" });
      const extended = (await page.locator("text=延長中").count()) > 0;
      await shot(page, "r02-soft-close");
      log("締切直前の入札で自動延長が働く", extended);
    } else {
      await shot(page, "x-no-extension");
      const badges = await page.locator(".badge").allInnerTexts();
      console.log("  [diag] url:", page.url());
      console.log("  [diag] badges:", badges.join(" / "));
      console.log("  [diag] amount field:", await page.locator('input[name="amount"]').count());
      log("締切直前の入札で自動延長が働く", false, "extension badge or bid field missing");
    }
    await c.close();
  }

  // ============================================= 3. card ceiling is enforced
  {
    const c = await ctx();
    const page = await c.newPage();
    await signIn(page, "admin@sktes-demo.com");
    await page.goto(`${BASE}/contracts`, { waitUntil: "networkidle" });

    const hrefs = await page
      .locator('table tbody a[href^="/contracts/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));

    let overLimit = null;
    let underLimit = null;
    for (const h of hrefs.slice(0, 20)) {
      await page.goto(BASE + h, { waitUntil: "networkidle" });
      const blocked = await page.locator("text=上限を超えています").count();
      if (blocked && !overLimit) overLimit = h;
      if (!blocked && !underLimit) {
        const hasCard = await page.locator('button:has-text("クレジットカード")').count();
        if (hasCard) underLimit = h;
      }
      if (overLimit && underLimit) break;
    }

    if (overLimit) {
      await page.goto(BASE + overLimit, { waitUntil: "networkidle" });
      const cardDisabled = await page
        .locator('button:has-text("クレジットカード")')
        .first()
        .isDisabled()
        .catch(() => false);
      await shot(page, "r03-card-limit");
      log("上限超えの契約はカード決済を選べない", cardDisabled);
    } else {
      log("上限超えの契約はカード決済を選べない", false, "no contract over the ceiling");
    }
    log(
      "上限内の契約はカード決済を選べる",
      Boolean(underLimit),
      underLimit ? "" : "none found"
    );
    await c.close();
  }

  // ======================================== 4. domestic vs export tax split
  {
    const c = await ctx();
    const page = await c.newPage();
    await signIn(page, "admin@sktes-demo.com");
    await page.goto(`${BASE}/contracts`, { waitUntil: "networkidle" });
    const hrefs = await page
      .locator('table tbody a[href^="/contracts/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));

    let domestic = false;
    let exportExempt = false;
    for (const h of hrefs.slice(0, 25)) {
      await page.goto(BASE + h, { waitUntil: "networkidle" });
      const body = await page.locator("body").innerText();
      const isJp = body.includes("適格請求書発行事業者登録番号");
      const isExport = body.includes("輸出免税");
      if (isJp && !domestic) {
        domestic = /消費税\s*10%/.test(body) && /T\d{13}/.test(body);
        if (domestic) await shot(page, "r04-invoice-domestic");
      }
      if (isExport && !exportExempt) {
        exportExempt = !/T\d{13}/.test(body);
        if (exportExempt) await shot(page, "r05-invoice-export");
      }
      if (domestic && exportExempt) break;
    }
    log("国内バイヤーには消費税10%と適格請求書番号が出る", domestic);
    log("海外バイヤーには輸出免税で番号が出ない", exportExempt);
    await c.close();
  }

  // ================================================== 5. bid can be withdrawn
  {
    const c = await ctx();
    const page = await c.newPage();
    await signIn(page, "buyer@sktes-demo.com");
    await page.goto(`${BASE}/bids`, { waitUntil: "networkidle" });
    const href = await page
      .locator('a[href^="/lots/"]')
      .first()
      .getAttribute("href")
      .catch(() => null);

    if (href) {
      await page.goto(BASE + href, { waitUntil: "networkidle" });
      const cancel = page.locator('button:has-text("入札を取り消す")').first();
      if (await cancel.count()) {
        await act(page, cancel);
        const gone = (await page.locator("text=あなたの入札").count()) === 0;
        await shot(page, "r06-bid-withdrawn");
        log("入札を取り消せる", gone);
      } else {
        log("入札を取り消せる", false, "no cancel button");
      }
    } else {
      log("入札を取り消せる", false, "no existing bid");
    }
    await c.close();
  }

  // =========================== 6. questions are visible to every bidder
  {
    const ask = await ctx();
    const p1 = await ask.newPage();
    await signIn(p1, "buyer@sktes-demo.com");
    await p1.goto(`${BASE}/lots?status=OPEN`, { waitUntil: "networkidle" });
    const href = await p1.locator('a[href^="/lots/"]').first().getAttribute("href");
    await p1.goto(BASE + href, { waitUntil: "networkidle" });
    const text = `全応札者に見える質問 ${stamp}`;
    await p1.fill('textarea[name="body"]', text);
    await act(p1, p1.locator('button:has-text("質問する")').first());
    await ask.close();

    const other = await ctx();
    const p2 = await other.newPage();
    await signIn(p2, "buyer2@buyer-demo.com");
    await p2.goto(BASE + href, { waitUntil: "networkidle" });
    const visible = (await p2.locator(`text=${stamp}`).count()) > 0;
    await shot(p2, "r07-question-shared");
    log("質問は他の応札者にも公開される", visible);
    await other.close();
  }

  // ================================================== 7. audit log filtering
  {
    const c = await ctx();
    const page = await c.newPage();
    await signIn(page, "admin@sktes-demo.com");
    await page.goto(`${BASE}/admin/audit`, { waitUntil: "networkidle" });
    const all = await page.locator("table tbody tr").count();

    await page.goto(`${BASE}/admin/audit?action=BID_SUBMIT`, { waitUntil: "networkidle" });
    const filtered = await page.locator("table tbody tr").count();
    const onlyBids = await page
      .locator("table tbody tr")
      .evaluateAll((rows) => rows.every((r) => r.textContent.includes("BID_SUBMIT")));
    await shot(page, "r08-audit-filtered");
    log(
      "監査ログを操作種別で絞り込める",
      filtered > 0 && filtered <= all && onlyBids,
      `${filtered}/${all}`
    );
    await c.close();
  }

  // ==================================================== 8. password change
  {
    const c = await ctx();
    const page = await c.newPage();
    await signIn(page, "buyer3@buyer-demo.com");
    await page.goto(`${BASE}/settings/security`, { waitUntil: "networkidle" });

    await page.fill('input[name="current"]', "Demo!2026");
    await page.fill('input[name="next"]', "Changed!2026");
    await page.fill('input[name="confirm"]', "Changed!2026");
    await act(page, page.locator('form:has(input[name="current"]) button[type="submit"]').first());
    const changed = (await page.locator("text=パスワードを変更しました").count()) > 0;
    log("パスワードを変更できる", changed);

    if (changed) {
      const c2 = await ctx();
      const p2 = await c2.newPage();
      await signIn(p2, "buyer3@buyer-demo.com", "Changed!2026");
      log("新しいパスワードでログインできる", p2.url().includes("/dashboard"));
      await c2.close();
    }
    await c.close();
  }

  // ================================================= 9. manifest export works
  {
    const c = await ctx();
    const page = await c.newPage();
    await signIn(page, "admin@sktes-demo.com");
    await page.goto(`${BASE}/lots`, { waitUntil: "networkidle" });
    const href = await page.locator('a[href^="/lots/"]').first().getAttribute("href");
    const lotId = href.split("/").pop();

    const res = await page.request.get(`${BASE}/api/lots/${lotId}/manifest`);
    const body = await res.body();
    // a real xlsx is a zip, which always starts PK
    log(
      "ロット明細をExcelで書き出せる",
      res.ok() && body.subarray(0, 2).toString() === "PK",
      `${res.status()} ${body.length}B`
    );
    await c.close();
  }
} catch (err) {
  log("run", false, err.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed.` +
    (failed.length ? `\n\nFailed:\n${failed.map((f) => `  - ${f.name} ${f.detail}`).join("\n")}` : "")
);
process.exit(failed.length ? 1 : 0);
