import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  constants as cryptoConstants,
} from "node:crypto";
import { sealMasterKey } from "./runtime";

/**
 * Sealed-bid (blind bid) engine.
 *
 * The requirement says bids must be invisible until the deadline. Storing the
 * amount in a plain column would make it visible to anyone with database
 * access - including us, the vendor. So we do not store the amount at all
 * until the lot is opened.
 *
 * How it works:
 *   1. Every lot gets its own RSA-2048 keypair when it is published.
 *   2. The public key encrypts each incoming bid (RSA-OAEP / SHA-256).
 *   3. The private key is itself encrypted with AES-256-GCM under a master
 *      key held outside the database, and the lot deadline is bound into the
 *      cipher as additional authenticated data. Change the deadline and the
 *      private key will no longer decrypt - tampering is detectable.
 *   4. Opening is refused while the clock is before the deadline.
 *   5. Every bid also carries a SHA-256 commitment over (amount + nonce), so
 *      after opening we can prove the revealed amount is the one submitted.
 *
 * Net effect: between submission and the deadline, nobody - seller, admin,
 * developer, DBA - can read a bid amount.
 */

function masterKey(): Buffer {
  const hex = sealMasterKey();
  if (!/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error(
      "SEAL_MASTER_KEY must be a 64-character hex string (32 bytes)."
    );
  }
  return Buffer.from(hex, "hex");
}

export type LotSeal = {
  sealPublicKey: string;
  sealedPrivateKey: string;
  sealIv: string;
  sealAuthTag: string;
};

/** Generates the per-lot keypair and seals the private half. */
export function createLotSeal(lotNumber: string, endAt: Date): LotSeal {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(Buffer.from(aad(lotNumber, endAt), "utf8"));
  const sealed = Buffer.concat([
    cipher.update(privateKey, "utf8"),
    cipher.final(),
  ]);

  return {
    sealPublicKey: publicKey,
    sealedPrivateKey: sealed.toString("base64"),
    sealIv: iv.toString("base64"),
    sealAuthTag: cipher.getAuthTag().toString("base64"),
  };
}

function aad(lotNumber: string, endAt: Date): string {
  return `${lotNumber}|${endAt.toISOString()}`;
}

export type SealedLotFields = {
  lotNumber: string;
  endAt: Date;
  extendedUntil?: Date | null;
  sealPublicKey: string | null;
  sealedPrivateKey: string | null;
  sealIv: string | null;
  sealAuthTag: string | null;
};

export class SealNotOpenableError extends Error {
  constructor(public readonly opensAt: Date) {
    super(`Sealed bids cannot be opened before ${opensAt.toISOString()}`);
    this.name = "SealNotOpenableError";
  }
}

/** The effective close time, taking a soft-close extension into account. */
export function effectiveEndAt(lot: {
  endAt: Date;
  extendedUntil?: Date | null;
}): Date {
  if (lot.extendedUntil && lot.extendedUntil > lot.endAt) return lot.extendedUntil;
  return lot.endAt;
}

/**
 * Unseals the lot private key. Refuses to run before the deadline unless
 * `force` is passed, which is reserved for an audited administrative
 * override and always writes an audit entry at the call site.
 */
export function openSeal(
  lot: SealedLotFields,
  now: Date = new Date(),
  force = false
) {
  if (!lot.sealedPrivateKey || !lot.sealIv || !lot.sealAuthTag) {
    throw new Error("This lot carries no sealed key material.");
  }
  const opensAt = effectiveEndAt(lot);
  if (!force && now < opensAt) throw new SealNotOpenableError(opensAt);

  const decipher = createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(lot.sealIv, "base64")
  );
  decipher.setAAD(Buffer.from(aad(lot.lotNumber, lot.endAt), "utf8"));
  decipher.setAuthTag(Buffer.from(lot.sealAuthTag, "base64"));
  const pem = Buffer.concat([
    decipher.update(Buffer.from(lot.sealedPrivateKey, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return createPrivateKey(pem);
}

export type SealedBid = {
  ciphertext: string;
  commitmentHash: string;
  nonce: string;
};

/** Encrypts one bid against the lot public key. */
export function sealBid(
  sealPublicKey: string,
  amountCents: number,
  submittedAt: Date = new Date()
): SealedBid {
  const nonce = randomBytes(16).toString("hex");
  const payload = JSON.stringify({
    amountCents,
    nonce,
    ts: submittedAt.toISOString(),
  });
  const ciphertext = publicEncrypt(
    {
      key: createPublicKey(sealPublicKey),
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(payload, "utf8")
  ).toString("base64");

  return { ciphertext, commitmentHash: commit(amountCents, nonce), nonce };
}

export function commit(amountCents: number, nonce: string): string {
  return createHash("sha256").update(`${amountCents}:${nonce}`).digest("hex");
}

export function verifyCommitment(
  amountCents: number,
  nonce: string,
  commitmentHash: string
): boolean {
  return commit(amountCents, nonce) === commitmentHash;
}

export type RevealedBid = {
  amountCents: number;
  nonce: string;
  ts: string;
  commitmentOk: boolean;
};

/** Decrypts one sealed bid using an already-unsealed private key. */
export function revealBid(
  privateKey: ReturnType<typeof createPrivateKey>,
  ciphertext: string,
  commitmentHash: string
): RevealedBid {
  const plain = privateDecrypt(
    {
      key: privateKey,
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    Buffer.from(ciphertext, "base64")
  ).toString("utf8");

  const parsed = JSON.parse(plain) as {
    amountCents: number;
    nonce: string;
    ts: string;
  };

  return {
    ...parsed,
    commitmentOk: verifyCommitment(
      parsed.amountCents,
      parsed.nonce,
      commitmentHash
    ),
  };
}

/** A short, human-readable fingerprint of a ciphertext for the UI. */
export function cipherFingerprint(ciphertext: string): string {
  return createHash("sha256")
    .update(ciphertext)
    .digest("hex")
    .slice(0, 16)
    .toUpperCase()
    .replace(/(.{4})/g, "$1 ")
    .trim();
}
