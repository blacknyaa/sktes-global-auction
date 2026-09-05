import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * Concurrency and load.
 *
 * The proposal calls simultaneous bidding the hardest part of an auction
 * system, and until the demo ran on a shared database there was no way to
 * check it: every request had its own copy of the data. Now several instances
 * talk to one PostgreSQL, so the races are real and worth proving.
 *
 * What must hold when several people act at the same instant:
 *   - every bid submitted is recorded, none silently lost
 *   - one bidder cannot end up with two live bids on one lot
 *   - a lot opens once, however many administrators press the button
 *   - a lot is awarded once, however many sellers press the button
 *   - the whole thing stays inside the response time the brief asks for
 *
 *   node scripts/concurrency.mjs
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "screenshots");
mkdirSync(OUT, { recursive: true });

const results = [];
function log(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();

async function session(email, password = "Demo!2026") {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });
  ctx.on("page", (p) => p.on("dialog", (d) => d.accept()));
  await ctx.addCookies([{ name: "sktes_locale", value: "ja", url: BASE }]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL(/\/(dashboard|login\/mfa)/, { timeout: 60000 }),
    page.click('button[type="submit"]'),
  ]);
  return { ctx, page };
}

async function settle(page, timeout = 60000) {
  await page
    .waitForFunction(() => !document.querySelector('button[aria-busy="true"]'), undefined, {
      timeout,
      polling: 100,
    })
    .catch(() => {});
}

/** Reads the bid count shown on a lot page. */
async function bidCount(page, href) {
  await page.goto(BASE + href, { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();
  const m = text.match(/入札数\s*\n?\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

try {
  // =============================== 1. many bidders, one lot, one instant
  {
    const admin = await session("admin@sktes-demo.com");
    await admin.page.goto(`${BASE}/lots?status=OPEN&sort=closing`, {
      waitUntil: "networkidle",
    });
    const hrefs = await admin.page
      .locator('a[href^="/lots/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));

    // a lot that closes far enough out that nothing expires mid-test
    let target = null;
    for (const h of hrefs.slice(0, 12)) {
      await admin.page.goto(BASE + h, { waitUntil: "networkidle" });
      const open = await admin.page.locator("text=入札受付中").count();
      if (open) {
        target = h;
        break;
      }
    }
    if (!target) throw new Error("no open lot to bid on");

    const before = await bidCount(admin.page, target);
    const minimum = await admin.page
      .locator("body")
      .innerText()
      .then((t) => {
        const m = t.match(/最低入札額\s*\n?\s*\$?([\d,]+)/);
        return m ? Number(m[1].replace(/,/g, "")) : 1000;
      });

    // eight different buyers, opened in parallel, submitting together
    const emails = Array.from({ length: 8 }, (_, i) => `buyer${i + 10}@buyer-demo.com`);
    const sessions = [];
    for (const e of emails) {
      try {
        sessions.push(await session(e));
      } catch {
        /* a suspended or pending member simply does not take part */
      }
    }

    // A company that already holds a bid is amending, not adding: its old bid
    // is superseded and the visible count stays put. Counting the two cases
    // separately is the difference between measuring a race and inventing one.
    const bidders = [];
    const capped = [];
    let fresh = 0;
    let amending = 0;
    for (const s of sessions) {
      await s.page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
      // A conditionally approved member carries a bid ceiling far below the
      // value of these lots, so it is held out of the simultaneous group and
      // checked separately - the ceiling is a rule, not a failure.
      const hasCap = /入札上限額/.test(await s.page.locator("body").innerText());
      await s.page.goto(BASE + target, { waitUntil: "networkidle" });
      if (!(await s.page.locator('input[name="amount"]').count())) continue;
      if (hasCap) {
        capped.push(s);
        continue;
      }
      const already = (await s.page.locator("text=あなたの入札").count()) > 0;
      s.amending = already;
      if (already) amending++;
      else fresh++;
      bidders.push(s);
    }

    // fill every form first, so the submits really do land together
    await Promise.all(
      bidders.map((s, i) =>
        s.page.locator('input[name="amount"]').fill(String(Math.round(minimum * (1.2 + i * 0.05))))
      )
    );

    const t0 = Date.now();
    const outcomes = await Promise.all(
      bidders.map(async (s, i) => {
        const started = Date.now();
        try {
          await s.page
            .locator('form:has(input[name="amount"]) button[type="submit"]')
            .first()
            .click();
          await settle(s.page);
          const ok = await s.page
            .waitForSelector("text=あなたの入札", { timeout: 15000 })
            .then(() => true)
            .catch(() => false);
          if (!ok) {
            // Report what the person actually saw, so a lost bid is explained
            // rather than merely counted.
            const body = await s.page.locator("body").innerText().catch(() => "");
            const shown = body
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => /エラー|失敗|できません|しばらく|再度|問題/.test(l))
              .slice(0, 2)
              .join(" / ");
            console.log(
              `  [diag] bidder ${i} failed after ${Date.now() - started}ms` +
                (shown ? ` — 画面表示: ${shown}` : " — 画面に案内なし")
            );
            await s.page.screenshot({
              path: path.join(OUT, `x-lost-bid-${i}.png`),
              fullPage: true,
            });
          } else {
            console.log(`  [diag] bidder ${i} ok in ${Date.now() - started}ms`);
          }
          return ok;
        } catch (e) {
          console.log(`  [diag] bidder ${i} threw after ${Date.now() - started}ms: ${e.message.slice(0, 90)}`);
          return false;
        }
      })
    );
    const elapsed = Date.now() - t0;

    const accepted = outcomes.filter(Boolean).length;
    const after = await bidCount(admin.page, target);
    const expected = before + fresh;

    log(
      `${bidders.length}社が同時に入札しても全件記録される`,
      bidders.length > 1 && after === expected && accepted === bidders.length,
      `新規${fresh}社 + 再入札${amending}社 / 入札数 ${before} -> ${after}（期待 ${expected}）/ 画面確認 ${accepted}/${bidders.length} / ${elapsed}ms`
    );

    // Every participant must still be able to see their own bid afterwards.
    let visible = 0;
    for (const s of bidders) {
      await s.page.goto(BASE + target, { waitUntil: "networkidle" });
      if ((await s.page.locator("text=あなたの入札").count()) > 0) visible++;
    }
    log(
      "同時入札後も全社が自分の入札を確認できる",
      visible === bidders.length,
      `${visible}/${bidders.length}`
    );

    // ---------- 1b. the bid ceiling is enforced ----------
    if (capped.length) {
      const s = capped[0];
      await s.page.goto(BASE + target, { waitUntil: "networkidle" });
      // Comfortably above any conditional ceiling, and above the lot minimum,
      // so the refusal under test is unambiguous.
      const overCap = Math.max(Math.round(minimum * 1.3), 100000);
      await s.page.locator('input[name="amount"]').fill(String(overCap));
      await s.page
        .locator('form:has(input[name="amount"]) button[type="submit"]')
        .first()
        .click();
      await settle(s.page);
      const refused = await s.page
        .waitForSelector("text=入札上限額を超えています", { timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      const noBid = (await s.page.locator("text=あなたの入札").count()) === 0;
      log("入札上限を超える入札は理由を示して拒否される", refused && noBid);
    } else {
      log("入札上限を超える入札は理由を示して拒否される", false, "no capped member available");
    }

    // ---------- 2. one bidder, two submissions at once ----------
    if (bidders.length) {
      const s = bidders[0];
      const countBefore = await bidCount(admin.page, target);
      await s.page.goto(BASE + target, { waitUntil: "networkidle" });
      const amount = String(Math.round(minimum * 3));
      await s.page.locator('input[name="amount"]').fill(amount);

      // two clicks fired without waiting for the first to come back
      const btn = s.page.locator('form:has(input[name="amount"]) button[type="submit"]').first();
      await Promise.all([btn.click(), btn.click().catch(() => {})]);
      await settle(s.page);
      await s.page.waitForTimeout(1500);

      const countAfter = await bidCount(admin.page, target);
      log(
        "同じ応札者の二重送信で入札が二重にならない",
        countAfter - countBefore <= 1,
        `${countBefore} -> ${countAfter}`
      );
    }

    for (const s of sessions) await s.ctx.close();
    await admin.ctx.close();
  }

  // ============================== 3. two administrators open one lot
  {
    const a = await session("admin@sktes-demo.com");
    const b = await session("admin2@sktes-demo.com");

    await a.page.goto(`${BASE}/lots?status=CLOSED`, { waitUntil: "networkidle" });
    const hrefs = await a.page
      .locator('a[href^="/lots/"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("href")));

    let target = null;
    for (const h of hrefs.slice(0, 15)) {
      await a.page.goto(BASE + h, { waitUntil: "networkidle" });
      if (await a.page.locator('button:has-text("封印を解除")').count()) {
        target = h;
        break;
      }
    }

    if (!target) {
      log("2人が同時に開封しても一度しか開封されない", false, "no unopened closed lot");
    } else {
      await b.page.goto(BASE + target, { waitUntil: "networkidle" });
      const btnA = a.page.locator('button:has-text("封印を解除")').first();
      const btnB = b.page.locator('button:has-text("封印を解除")').first();
      await Promise.all([btnA.click(), btnB.click().catch(() => {})]);
      await Promise.all([settle(a.page), settle(b.page)]);
      await a.page.waitForTimeout(2000);

      await a.page.goto(BASE + target, { waitUntil: "networkidle" });
      const body = await a.page.locator("body").innerText();
      const mismatched = (body.match(/不一致/g) ?? []).length;
      const stillSealed = (body.match(/封印中/g) ?? []).length;
      await a.page.screenshot({ path: path.join(OUT, "c01-concurrent-open.png"), fullPage: true });

      log(
        "2人が同時に開封しても一度しか開封されない",
        mismatched === 0 && stillSealed === 0,
        `不一致=${mismatched} 封印中=${stillSealed}`
      );

      // ---------- 4. two sellers award the same lot at once ----------
      const forms = a.page.locator('form:has(input[name="reason"])');
      const n = await forms.count();
      if (n >= 2) {
        await b.page.goto(BASE + target, { waitUntil: "networkidle" });
        await a.page.locator('form input[name="reason"]').first().fill("同時実行テストA");
        await b.page.locator('form input[name="reason"]').nth(1).fill("同時実行テストB");

        await Promise.all([
          a.page.locator('form:has(input[name="reason"]) button:has-text("落札者にする")').first().click(),
          b.page
            .locator('form:has(input[name="reason"]) button:has-text("落札者にする")')
            .nth(1)
            .click()
            .catch(() => {}),
        ]);
        await Promise.all([settle(a.page), settle(b.page)]);
        await a.page.waitForTimeout(2500);

        await a.page.goto(BASE + target, { waitUntil: "networkidle" });
        const after = await a.page.locator("body").innerText();
        const awardLinks = await a.page.locator('a[href^="/contracts/"]').count();
        const reasons = ["同時実行テストA", "同時実行テストB"].filter((r) => after.includes(r));
        await a.page.screenshot({ path: path.join(OUT, "c02-concurrent-award.png"), fullPage: true });

        log(
          "2人が同時に落札確定しても契約は1件だけ",
          awardLinks <= 1 && reasons.length === 1,
          `契約リンク=${awardLinks} 記録された理由=${reasons.join(",") || "なし"}`
        );
      } else {
        log("2人が同時に落札確定しても契約は1件だけ", false, `bids on lot: ${n}`);
      }
    }

    await a.ctx.close();
    await b.ctx.close();
  }

  // ===================================== 5. load: many requests at once
  {
    const { ctx, page } = await session("admin@sktes-demo.com");
    const paths = ["/dashboard", "/lots", "/contracts", "/admin/members", "/reports"];
    const rounds = 6;

    const timings = [];
    let failures = 0;
    for (let r = 0; r < rounds; r++) {
      await Promise.all(
        paths.map(async (p) => {
          const t = Date.now();
          try {
            const res = await page.request.get(BASE + p, { timeout: 30000 });
            if (!res.ok()) failures++;
          } catch {
            failures++;
          }
          timings.push(Date.now() - t);
        })
      );
    }

    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(timings.length * 0.95) - 1] ?? timings.at(-1);
    const worst = timings.at(-1);
    log(
      `同時アクセス${paths.length * rounds}件でエラーが出ない`,
      failures === 0,
      `${failures} failures`
    );
    log(
      `負荷時も応答3秒以内（95パーセンタイル ${p95}ms / 最遅 ${worst}ms）`,
      worst <= 3000
    );
    await ctx.close();
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
