import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { createHmac } from "node:crypto";

/**
 * Full business-flow test.
 *
 * The e2e script proves each screen renders. This one proves the business
 * actually works end to end: a new buyer registers, an administrator reviews
 * and approves them, they bid, the lot closes, the seller opens the seal and
 * awards, an invoice is issued, payment is confirmed, goods ship, the buyer
 * confirms receipt. Anything that breaks in the middle of that chain is a bug
 * the client would hit on day one.
 *
 *   node scripts/flow.mjs
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
  const style = await page.addStyleTag({
    content: "*{position:static !important}[data-keep-sticky]{position:sticky !important}",
  });
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  await style.evaluate((el) => el.remove()).catch(() => {});
}

// --- TOTP, so the test can log in through MFA like a real user -------------
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(input) {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const bytes = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
function totp(secret, at = new Date()) {
  const counter = Math.floor(at.getTime() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const d = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = d[d.length - 1] & 0x0f;
  const bin =
    ((d[o] & 0x7f) << 24) | ((d[o + 1] & 0xff) << 16) | ((d[o + 2] & 0xff) << 8) | (d[o + 3] & 0xff);
  return String(bin % 1e6).padStart(6, "0");
}

// --- a tiny valid PDF and XLSX for the upload tests ------------------------
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
);
const pdfPath = path.join(TMP, "registry.pdf");
writeFileSync(pdfPath, PDF);

const browser = await chromium.launch();
const ctx = async () => {
  const c = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });
  // The product asks for confirmation before destructive actions; a test that
  // let Playwright auto-dismiss those dialogs would silently cancel every one.
  c.on("page", (p) => p.on("dialog", (d) => d.accept()));
  // Pin the UI to Japanese. Without this the language follows each member's
  // stored preference, so a Singapore buyer would render in English and every
  // assertion below would be reading the wrong words. The preference itself is
  // covered by its own check further down.
  await c.addCookies([{ name: "sktes_locale", value: "ja", url: BASE }]);
  return c;
};

async function login(page, email, password = "Demo!2026") {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="loginId"]', email);
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

/**
 * Waits until no submit button is still reporting aria-busy.
 *
 * A server action here is a full round trip - decrypt, write, audit, notify -
 * and on the dev server that is comfortably over a second. Fixed sleeps make
 * the test lie; this waits for the UI to actually settle.
 */
async function settle(page, timeout = 30000) {
  await page
    .waitForFunction(
      () => !document.querySelector('button[aria-busy="true"]'),
      undefined,
      { timeout, polling: 100 }
    )
    .catch(() => {});
  await page.waitForTimeout(400);
}

/** Clicks and waits for the resulting action to finish. */
async function act(page, locator) {
  await locator.click();
  // Wait for the pending state to appear before waiting for it to clear.
  // Without this the settle check can slip through the gap between the click
  // and React flipping the button, and the assertion then reads a stale page.
  await page
    .waitForFunction(
      () => !!document.querySelector('button[aria-busy="true"]'),
      undefined,
      { timeout: 3000, polling: 50 }
    )
    .catch(() => {});
  await settle(page);
}

/**
 * The flow consumes state: it opens sealed lots, approves members, marks
 * invoices paid. Running it twice against the same data would find nothing
 * left to open, so it starts from a fresh seed unless told otherwise.
 */
if (!process.argv.includes("--no-seed")) {
  console.log("reseeding demo data...\n");
  execFileSync(
    process.execPath,
    ["--env-file=.env", "--import", "tsx", "prisma/seed/index.ts"],
    { stdio: ["ignore", "ignore", "inherit"] }
  );
}

const stamp = Date.now().toString().slice(-7);
const newBuyerEmail = `flowtest${stamp}@buyer-demo.com`;
const newBuyerId = `flowtest${stamp}`;
let newCompanyUrl = null;

try {
  // ======================================================== 1. registration
  {
    const c = await ctx();
    const page = await c.newPage();
    await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });

    await page.fill('input[name="companyName"]', `フローテスト商事 ${stamp}`);
    await page.fill('input[name="companyNameEn"]', `Flow Test Trading ${stamp}`);
    await page.selectOption('select[name="countryCode"]', "SG");
    await page.fill('input[name="contactName"]', "Test Buyer");
    await page.fill('input[name="contactPhone"]', "+65-6000-1234");
    await page.fill('input[name="contactEmail"]', newBuyerEmail);
    await page.fill('input[name="loginId"]', newBuyerId);
    await page.fill('input[name="password"]', "FlowTest2026");
    await page.fill('input[name="hqAddress"]', "1 Test Road, Singapore");
    await page.locator('input[name="hasImportLicense"][value="yes"]').check();
    await page.click('button:has-text("次へ")');

    await page.setInputFiles('input[name="doc_registry"]', pdfPath);
    await page.setInputFiles('input[name="doc_id"]', pdfPath);
    const importField = page.locator('input[name="doc_import"]');
    if (await importField.count()) await importField.setInputFiles(pdfPath);
    await page.locator('button:has-text("次へ")').nth(1).click();

    await page.locator('input[name="agree"]').check();
    await Promise.all([
      page.waitForURL(/\/register\/done/, { timeout: 30000 }),
      page.locator('button:has-text("仮登録を申請する")').click(),
    ]);
    await shot(page, "f01-register-done");
    log("新規会員が仮登録を完了できる", page.url().includes("/register/done"));
    await c.close();
  }

  // ============================================ 2. blocked before approval
  {
    const c = await ctx();
    const page = await c.newPage();
    await login(page, newBuyerId, "FlowTest2026");
    await page.goto(`${BASE}/lots?status=OPEN`, { waitUntil: "networkidle" });
    const link = page.locator('a[href^="/lots/"]').first();
    const href = await link.getAttribute("href");
    await page.goto(BASE + href, { waitUntil: "networkidle" });
    const blocked =
      (await page.locator("text=本登録が完了していないため入札できません").count()) > 0;
    const noField = (await page.locator('input[name="amount"]').count()) === 0;
    await shot(page, "f02-unapproved-cannot-bid");
    log("審査前のバイヤーは入札できない", blocked && noField);
    await c.close();
  }

  // ================================================== 3. admin review flow
  {
    const c = await ctx();
    const page = await c.newPage();
    await login(page, "admin");

    await page.goto(`${BASE}/admin/members?status=PENDING`, { waitUntil: "networkidle" });
    const row = page.locator(`table tbody tr:has-text("${stamp}") a`).first();
    log("仮登録の会員が審査待ち一覧に出る", (await row.count()) > 0);
    if (await row.count()) {
      newCompanyUrl = await row.getAttribute("href");
      await page.goto(BASE + newCompanyUrl, { waitUntil: "networkidle" });

      // approve each submitted document
      for (let i = 0; i < 5; i++) {
        const btn = page.locator(String.raw`button:has-text("書類を承認")`).first();
        if (!(await btn.count())) break;
        await act(page, btn);
      }
      const approvedBadges = await page.locator("text=承認済").count();
      log("提出書類を1件ずつ承認できる", approvedBadges >= 2, `${approvedBadges} approved`);

      // uploaded document must be retrievable and be the real file
      const docLink = page.locator('a[href^="/api/documents/"]').first();
      const dh = await docLink.getAttribute("href");
      const res = await page.request.get(BASE + dh);
      const body = await res.body();
      log(
        "アップロードした書類を取得できる",
        res.ok() && body.subarray(0, 4).toString() === "%PDF",
        `${res.status()} ${body.length}B`
      );

      // provisional first, then full approval
      await act(page, page.locator(String.raw`button:has-text("仮承認")`).first());
      // the bid-cap badge only appears in the header once a cap is stored
      const provisional = (await page.locator("text=入札上限額").count()) > 0;
      await shot(page, "f03a-member-provisional");
      log("入札上限つきの仮承認ができる", provisional);

      const fullApprove = page.locator('button:has-text("本登録にする")').first();
      if (!(await fullApprove.count())) {
        await shot(page, "x-no-full-approve");
        console.log("  [diag] url:", page.url());
        console.log(
          "  [diag] visible buttons:",
          await page.locator("button[type=submit]").allInnerTexts()
        );
      }
      await act(page, fullApprove);
      // The input label always reads 入札上限額; only the header badge means a
      // cap is actually stored. Wait for it to go rather than sampling once.
      const capGone = await page
        .waitForFunction(
          () =>
            ![...document.querySelectorAll(".badge")].some((b) =>
              (b.textContent ?? "").includes("入札上限額")
            ),
          undefined,
          { timeout: 20000, polling: 200 }
        )
        .then(() => true)
        .catch(() => false);
      await shot(page, "f03-member-approved");
      log("本登録に切り替えると上限が外れる", capGone);
    }
    await logout(page);
    await c.close();
  }

  // ============================================ 4. approved buyer can bid
  let bidLotHref = null;
  {
    const c = await ctx();
    const page = await c.newPage();
    await login(page, newBuyerId, "FlowTest2026");
    await page.goto(`${BASE}/lots?status=OPEN&sort=bids`, { waitUntil: "networkidle" });
    bidLotHref = await page.locator('a[href^="/lots/"]').first().getAttribute("href");
    await page.goto(BASE + bidLotHref, { waitUntil: "networkidle" });

    const field = page.locator('input[name="amount"]');
    log("承認後は入札欄が出る", (await field.count()) > 0);
    if (await field.count()) {
      const min = Number(await field.getAttribute("min"));

      // below the minimum must be refused by the server, not just the browser
      await field.fill(String(Math.max(1, Math.floor(min * 0.5))));
      await page.evaluate(() => {
        document.querySelector('input[name="amount"]')?.removeAttribute("min");
      });
      await act(page, page.locator(String.raw`form:has(input[name="amount"]) button[type="submit"]`).first());
      log(
        "最低入札額を下回る入札はサーバー側で弾かれる",
        (await page.locator("text=最低入札額を下回っています").count()) > 0
      );

      // a valid bid
      await page.locator(String.raw`input[name="amount"]`).fill(String(Math.ceil(min * 1.4)));
      await act(page, page.locator(String.raw`form:has(input[name="amount"]) button[type="submit"]`).first());
      const accepted = await page
        .waitForSelector("text=改ざん検知ハッシュ", { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      if (!accepted) await shot(page, "x-bid-not-accepted");
      log("正しい金額の入札は受け付けられる", accepted);

      // re-bid supersedes rather than duplicates
      await page.locator(String.raw`input[name="amount"]`).fill(String(Math.ceil(min * 1.9)));
      await act(page, page.locator(String.raw`form:has(input[name="amount"]) button[type="submit"]`).first());
      const seq = await page
        .waitForSelector("text=あなたの入札 #2", { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      await shot(page, "f04-rebid");
      log("再入札すると連番が上がる", seq);

      // question to the seller
      await page.fill('textarea[name="body"]', `動作確認の質問です (${stamp})`);
      await act(page, page.locator(String.raw`button:has-text("質問する")`).first());
      log("出品者へ質問を投稿できる", (await page.locator(`text=${stamp}`).count()) > 0);
    }
    await logout(page);
    await c.close();
  }

  // ====================================== 5. seller: open seal → award → ship
  {
    const c = await ctx();
    const page = await c.newPage();
    await login(page, "admin");

    // Find a closed, unopened lot that has at least two bids, so the
    // runner-up path can be exercised.
    await page.goto(`${BASE}/lots?status=CLOSED&sort=bids`, { waitUntil: "networkidle" });
    const hrefs = await page.locator('a[href^="/lots/"]').evaluateAll((els) =>
      els.map((e) => e.getAttribute("href"))
    );
    let target = null;
    for (const href of hrefs.slice(0, 24)) {
      await page.goto(BASE + href, { waitUntil: "networkidle" });
      const openable = (await page.locator('button:has-text("封印を解除")').count()) > 0;
      const sealedCount = await page.locator('li:has-text("封印中")').count();
      if (openable && sealedCount >= 2) {
        target = href;
        break;
      }
    }

    if (!target) {
      log("開封可能な締切済ロットがある", false, "none found");
    } else {
      await page.goto(BASE + target, { waitUntil: "networkidle" });
      await shot(page, "f05-before-open");
      const sealedBefore = await page.locator("text=封印中").count();

      await act(page, page.locator(String.raw`button:has-text("封印を解除")`).first());
      await shot(page, "f06-after-open");

      const amountsShown = (await page.locator("text=一致").count()) > 0;
      log("締切後に封印を解除して金額が開示される", amountsShown, `sealed before: ${sealedBefore}`);
      log(
        "開封した全入札のハッシュが一致する",
        (await page.locator("text=不一致").count()) === 0
      );

      // award to the runner-up, which requires a reason
      const reasonInputs = page.locator('form input[name="reason"]');
      if ((await reasonInputs.count()) > 1) {
        await reasonInputs.nth(1).fill("動作確認：輸入ライセンス未提出のため次点を選定");
        await act(
          page,
          page.locator(String.raw`form:has(input[name="reason"]) button:has-text("落札者にする")`).nth(1)
        );
        await shot(page, "f07-awarded");
        const reasonRecorded =
          (await page.locator("text=動作確認：輸入ライセンス未提出のため次点を選定").count()) > 0;
        log("最高額以外を選ぶと理由が記録される", reasonRecorded);
        log("落札後に契約が作られる", (await page.locator('a[href^="/contracts/"]').count()) > 0);

        // follow through the contract
        const contractHref = await page.locator('a[href^="/contracts/"]').first().getAttribute("href");
        await page.goto(BASE + contractHref, { waitUntil: "networkidle" });
        await shot(page, "f08-contract-new");
        log("請求書が自動発行される", (await page.locator("text=請求書番号").count()) > 0);

        await page.fill('input[name="reference"]', `REF${stamp}`);
        await act(page, page.locator(String.raw`button:has-text("入金を確認する")`).first());
        log("入金確認で領収書が発行される", (await page.locator("text=領収書").count()) > 0);

        const carrier = page.locator('input[name="carrier"]').first();
        if (await carrier.count()) {
          await carrier.fill("DHL");
          await act(page, page.locator('button:has-text("発送を依頼する")').first());
          // the tracking field only appears once a shipment record exists
          await page
            .waitForSelector('input[name="trackingNo"]', { timeout: 20000 })
            .catch(() => {});
        }
        const tracking = page.locator('input[name="trackingNo"]');
        if (await tracking.count()) {
          await tracking.fill(`TRK${stamp}`);
          await act(page, page.locator('button:has-text("出荷完了を報告")').first());
        }
        await shot(page, "f09-contract-shipped");
        const shipped = await page
          .waitForSelector("text=出荷済", { timeout: 20000 })
          .then(() => true)
          .catch(() => false);
        if (!shipped) await shot(page, "x-not-shipped");
        log("発送依頼から出荷完了報告まで進める", shipped);
      } else {
        log("最高額以外を選ぶと理由が記録される", false, "only one bid on this lot");
      }
    }
    await logout(page);
    await c.close();
  }

  // ================================================== 6. MFA login round trip
  {
    const c = await ctx();
    const page = await c.newPage();
    await login(page, newBuyerId, "FlowTest2026");
    await page.goto(`${BASE}/settings/security`, { waitUntil: "networkidle" });

    if (!(await page.locator("[data-testid=mfa-secret]").count())) {
      const begin = page.locator('[data-testid=begin-mfa]').first();
      if (await begin.count()) await act(page, begin);
      await page
        .waitForSelector("[data-testid=mfa-secret]", { timeout: 30000 })
        .catch(() => {});
    }
    const secretText = await page
      .locator("[data-testid=mfa-secret]")
      .first()
      .innerText()
      .catch(() => "");
    const secret = secretText.replace(/\s/g, "");
    if (secret.length < 16) {
      await shot(page, "x-no-mfa-secret");
      console.log("  [diag] url:", page.url());
      console.log(
        "  [diag] testids:",
        await page.locator("[data-testid]").evaluateAll((els) =>
          els.map((e) => e.getAttribute("data-testid"))
        )
      );
      console.log(
        "  [diag] buttons:",
        await page.locator("button[type=submit]").allInnerTexts()
      );
    }
    log("MFAの秘密鍵が表示される", secret.length >= 16, `${secret.length} chars`);

    if (secret.length >= 16) {
      await page.fill('input[name="code"]', totp(secret));
      await act(page, page.locator(String.raw`form:has(input[name="code"]) button[type="submit"]`).first());
      log("生成したコードでMFAを有効化できる", (await page.locator("text=有効").count()) > 0);

      await logout(page);
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await page.fill('input[name="loginId"]', newBuyerId);
      await page.fill('input[name="password"]', "FlowTest2026");
      await Promise.all([
        page.waitForURL(/\/login\/mfa/, { timeout: 30000 }),
        page.click('button[type="submit"]'),
      ]);
      log("MFA有効時はコード入力画面に進む", page.url().includes("/login/mfa"));
      await shot(page, "f10-mfa-challenge");

      await page.fill('input[name="code"]', "000000");
      await act(page, page.locator(String.raw`button[type="submit"]`).first());
      const rejected = await page
        .waitForSelector("text=コードが正しくありません", { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      if (!rejected) await shot(page, "x-mfa-wrong-code");
      log("誤ったコードは拒否される", rejected);

      await page.fill('input[name="code"]', totp(secret));
      await Promise.all([
        page.waitForURL(/\/dashboard/, { timeout: 30000 }),
        page.locator('button[type="submit"]').click(),
      ]);
      log("正しいコードでログインできる", page.url().includes("/dashboard"));
    }
    await c.close();
  }

  // ============================================== 7. account lock on failures
  {
    const c = await ctx();
    const page = await c.newPage();
    for (let i = 0; i < 5; i++) {
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await page.fill('input[name="loginId"]', "buyer1");
      await page.fill('input[name="password"]', "wrong-password");
      await page.click('button[type="submit"]');
      await settle(page, 15000);
    }
    const locked = (await page.locator("text=アカウントを一時ロック").count()) > 0;
    await shot(page, "f11-account-locked");
    log("5回失敗でアカウントがロックされる", locked);
    await c.close();
  }

  // ================================================ 8. password reset round trip
  {
    const c = await ctx();
    const page = await c.newPage();
    await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "buyer1@buyer-demo.com");
    await act(page, page.locator(String.raw`button[type="submit"]`).first());
    const resetLink = await page
      .locator('a[href^="/reset-password?token="]')
      .first()
      .getAttribute("href")
      .catch(() => null);
    log("再設定リンクが発行される", Boolean(resetLink));

    if (resetLink) {
      await page.goto(BASE + resetLink, { waitUntil: "networkidle" });
      await page.fill('input[name="password"]', "short");
      await page.fill('input[name="confirm"]', "short");
      await act(page, page.locator(String.raw`button[type="submit"]`).first());
      log(
        "弱いパスワードは拒否される",
        (await page.locator("text=8文字以上").count()) > 0
      );

      await page.fill('input[name="password"]', "Relocked2026");
      await page.fill('input[name="confirm"]', "Relocked2026");
      await act(page, page.locator(String.raw`button[type="submit"]`).first());
      log("パスワードを再設定できる", (await page.locator("text=パスワードを変更しました").count()) > 0);

      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
      await page.fill('input[name="loginId"]', "buyer1");
      await page.fill('input[name="password"]', "Relocked2026");
      await Promise.all([
        page.waitForURL(/\/dashboard/, { timeout: 30000 }),
        page.click('button[type="submit"]'),
      ]);
      log("再設定でロックも解除される", page.url().includes("/dashboard"));
    }
    await c.close();
  }

  // ======================================= 8b. account language preference
  {
    // No locale cookie at all: the UI must follow the language stored on the
    // account. The buyer registered under a Singapore site, so English.
    const c = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
    });
    const page = await c.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="loginId"]', "buyer");
    await page.fill('input[name="password"]', "Demo!2026");
    await Promise.all([
      page.waitForURL(/\/dashboard/, { timeout: 30000 }),
      page.click('button[type="submit"]'),
    ]);
    await shot(page, "f12-account-language");
    const english = (await page.locator("text=Dashboard").count()) > 0;
    log("会員の言語設定が画面に反映される", english, english ? "EN" : "not EN");
    await c.close();
  }

  // ============================================= 9. authorisation boundaries
  {
    const c = await ctx();
    const page = await c.newPage();
    await login(page, "buyer");
    for (const url of ["/admin/members", "/admin/audit", "/admin/fraud", "/listings", "/listings/new"]) {
      await page.goto(BASE + url, { waitUntil: "networkidle" });
      log(`バイヤーは ${url} に入れない`, page.url().includes("/denied"), page.url().replace(BASE, ""));
    }
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
