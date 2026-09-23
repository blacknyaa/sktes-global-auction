import { clientIpFromForwarded } from "../src/lib/runtime";

/**
 * X-Forwarded-For's left side is attacker-controlled. We take the entry
 * added by the outermost trusted proxy (counting from the right).
 *
 * Run: npm run verify:client-ip
 */

let failures = 0;

function check(label: string, got: string, want: string) {
  const ok = got === want;
  if (!ok) failures++;
  console.log(`${ok ? "  ok " : "FAIL "} ${label} → ${got}${ok ? "" : ` (want ${want})`}`);
}

console.log("\n=== client IP from X-Forwarded-For ===\n");

check(
  "1 hop: take the rightmost (proxy-appended) address",
  clientIpFromForwarded("1.2.3.4, 10.0.0.1", 1),
  "10.0.0.1"
);
check(
  "2 hops: skip the outermost proxy, take the next",
  clientIpFromForwarded("spoof, client, edge", 2),
  "client"
);
check(
  "hops=0: ignore X-Forwarded-For, use X-Real-IP",
  clientIpFromForwarded("1.2.3.4, 10.0.0.1", 0, "9.9.9.9"),
  "9.9.9.9"
);
check(
  "no forwarding headers",
  clientIpFromForwarded(null, 1, null),
  "127.0.0.1"
);
check(
  "blank entries are dropped",
  clientIpFromForwarded("1.2.3.4,  , 10.0.0.1", 1),
  "10.0.0.1"
);

if (failures) {
  console.log(`\n${failures} check(s) failed\n`);
  process.exit(1);
}
console.log("\nall client-ip checks passed\n");
