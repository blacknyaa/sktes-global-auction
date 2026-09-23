import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Storage for uploaded files.
 *
 * The bytes live in the database rather than on disk. That is not the shape a
 * production system should keep - registry extracts and passports belong in
 * Azure Blob Storage with private containers and short-lived SAS URLs - but a
 * serverless host hands every request a fresh, read-only filesystem, so a file
 * written during registration would be gone before the reviewer opened it.
 *
 * Nothing outside this file knows where the bytes actually live, so moving to
 * blob storage stays a single-file change.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const ALLOWED_SHEET_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

export type StoredFile = {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export async function saveUpload(
  file: File,
  folder: string,
  mimeType = file.type || "application/octet-stream",
  db: Prisma.TransactionClient = prisma
): Promise<StoredFile> {
  // The name shown to reviewers keeps its letters in any script; only the
  // storage key is held to ASCII. `\w` alone is ASCII-only, and used here it
  // turned every Japanese file name into underscores.
  const safeName =
    file.name.replace(/[^\p{L}\p{N}_.\-() ]+/gu, "_").slice(0, 120) || "file";
  const keyName = safeName.replace(/[^\w.\-]+/g, "_");
  const storageKey = `${folder}/${randomUUID()}_${keyName}`;
  const data = Buffer.from(await file.arrayBuffer());

  await db.storedBlob.create({
    data: {
      storageKey,
      mimeType,
      sizeBytes: data.byteLength,
      data: new Uint8Array(data),
    },
  });

  return { storageKey, fileName: safeName, mimeType, sizeBytes: data.byteLength };
}

export async function readStored(key: string): Promise<Buffer | null> {
  const blob = await prisma.storedBlob.findUnique({
    where: { storageKey: key },
    select: { data: true },
  });
  return blob ? Buffer.from(blob.data) : null;
}

export async function readStoredWithType(
  key: string
): Promise<{ data: Buffer; mimeType: string } | null> {
  const blob = await prisma.storedBlob.findUnique({
    where: { storageKey: key },
    select: { data: true, mimeType: true },
  });
  return blob ? { data: Buffer.from(blob.data), mimeType: blob.mimeType } : null;
}

export function validateUpload(
  file: File,
  allowed: Set<string>
): string | null {
  if (file.size === 0) return "ファイルが空です。";
  if (file.size > MAX_UPLOAD_BYTES) return "ファイルサイズは10MBまでです。";
  if (file.type && !allowed.has(file.type)) {
    return `この形式には対応していません（${file.type}）。`;
  }
  return null;
}

function sniffDocumentType(head: Uint8Array): string | null {
  const at = (offset: number, ...bytes: number[]) =>
    bytes.every((b, i) => head[offset + i] === b);
  if (at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) {
    return "image/webp"; // RIFF....WEBP
  }
  return null;
}

/**
 * Member documents are served back inline, so their type is taken from the
 * first bytes of the file. The type the browser reports is chosen by the
 * sender and proves nothing about the contents.
 */
export async function inspectDocument(
  file: File
): Promise<{ mimeType: string } | { problem: string }> {
  const problem = validateUpload(file, ALLOWED_DOCUMENT_TYPES);
  if (problem) return { problem };
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mimeType = sniffDocumentType(head);
  if (!mimeType) {
    return { problem: "PDF・JPEG・PNG・WebP のいずれかのファイルを添付してください。" };
  }
  return { mimeType };
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
