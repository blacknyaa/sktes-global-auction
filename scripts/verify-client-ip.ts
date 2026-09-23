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
  clientIpFromForwarded("9.9.9.9, 203.0.113.7, 10.0.0.1", 2),
  "203.0.113.7"
);
check(
  "hops=0: ignore X-Forwarded-For, use X-Real-IP",
  clientIpFromForwarded("1.2.3.4, 10.0.0.1", 0, "9.9.9.9"),
  "9.9.9.9"
);
check(
  "no forwarding headers at all",
  clientIpFromForwarded(null, 1, null),
  "unknown"
);
check(
  "blank entries are dropped",
  clientIpFromForwarded("1.2.3.4,  , 10.0.0.1", 1),
  "10.0.0.1"
);

// Two things the first version let through.
check(
  "a chain shorter than the hops we trust is not evidence",
  clientIpFromForwarded("9.9.9.9", 2),
  "unknown"
);
check(
  "anything that is not an address is refused",
  clientIpFromForwarded("not-an-ip", 1),
  "unknown"
);
check(
  "a bracketed IPv6 address is kept",
  clientIpFromForwarded("[::1]", 1),
  "::1"
);

if (failures) {
  console.log(`\n${failures} check(s) failed\n`);
  process.exit(1);
}
console.log("\nall client-ip checks passed\n");
