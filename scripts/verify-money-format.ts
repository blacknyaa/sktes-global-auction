import { convertCents, formatMoney, minorUnits } from "../src/lib/format";

/**
 * Currencies without a minor unit must print whole.
 *
 * minorUnits and convertCents both read the zero-decimal set, but formatMoney
 * used to test `currency === "JPY"` on its own, so KRW, VND and IDR - all of
 * them seller-site currencies - printed a fractional part their notes do not
 * have (₩1,234.56).
 *
 * Run: npm run verify:money-format
 */

let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
}

const ZERO_DECIMAL = ["JPY", "KRW", "VND", "IDR"];
const WITH_DECIMAL = ["USD", "EUR", "GBP", "SGD", "CNY"];

console.log("\n=== currencies without a minor unit ===\n");

for (const currency of ZERO_DECIMAL) {
  const out = formatMoney(123_456, currency, "ja");
  check(`${currency} prints no fractional part`, !/[.,]\d\d$/.test(out), out);
  check(`${currency} minorUnits is 1`, minorUnits(currency) === 1, String(minorUnits(currency)));
  check(
    `${currency} conversion lands on a whole unit`,
    convertCents(100_000, 1234.5, currency) % 100 === 0,
    String(convertCents(100_000, 1234.5, currency))
  );
}

console.log("\n=== currencies with a minor unit ===\n");

for (const currency of WITH_DECIMAL) {
  const out = formatMoney(123_456, currency, "en");
  check(`${currency} keeps its two decimals`, /\d[.,]\d\d\b/.test(out), out);
  check(`${currency} minorUnits is 100`, minorUnits(currency) === 100, String(minorUnits(currency)));
}

console.log("\n=== rounding is half-up, not truncation ===\n");

check("JPY 1234.56 rounds up", formatMoney(123_456, "JPY", "ja").includes("1,235"), formatMoney(123_456, "JPY", "ja"));
check("KRW 1234.56 rounds up", formatMoney(123_456, "KRW", "ja").includes("1,235"), formatMoney(123_456, "KRW", "ja"));
check("KRW 1234.4 rounds down", formatMoney(123_440, "KRW", "ja").includes("1,234"), formatMoney(123_440, "KRW", "ja"));

if (failures) {
  console.log(`\n${failures} check(s) failed\n`);
  process.exit(1);
}
console.log("\nall money format checks passed\n");
