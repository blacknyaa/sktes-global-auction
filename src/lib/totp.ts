import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 time-based one-time passwords.
 *
 * Written by hand rather than pulled from a library so that the whole of the
 * authentication path can be read and audited in this repository. The secret
 * is standard base32, so Google Authenticator, Microsoft Authenticator, 1Password
 * and Authy all accept the QR code without any special handling.
 */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160-bit secret, the size recommended by RFC 4226. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, at: Date = new Date()): string {
  const counter = Math.floor(at.getTime() / 1000 / STEP_SECONDS);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Accepts the current code plus one step either side, which covers clock
 * drift between a phone in Manila and a server in Tokyo. Returns the time
 * step the code belongs to, or null. A code stays acceptable for up to three
 * steps, so callers that sign someone in must also refuse a step that has
 * already been used (see claimTotpStep in auth.ts).
 */
export function matchTotpStep(
  secret: string,
  token: string,
  at: Date = new Date(),
  window = 1
): number | null {
  const candidate = token.replace(/\D/g, "");
  if (candidate.length !== DIGITS) return null;
  for (let w = -window; w <= window; w++) {
    const t = new Date(at.getTime() + w * STEP_SECONDS * 1000);
    const expected = totpCode(secret, t);
    const a = Buffer.from(expected);
    const b = Buffer.from(candidate);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      return Math.floor(t.getTime() / 1000 / STEP_SECONDS);
    }
  }
  return null;
}

export function otpauthUrl(
  secret: string,
  account: string,
  issuer = "SK TES Global Auction"
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Seconds until the current code rolls over, for the countdown ring. */
export function secondsRemaining(at: Date = new Date()): number {
  return STEP_SECONDS - (Math.floor(at.getTime() / 1000) % STEP_SECONDS);
}
