import { randomUUID } from "node:crypto";
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
  folder: string
): Promise<StoredFile> {
  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
  const storageKey = `${folder}/${randomUUID()}_${safeName}`;
  const mimeType = file.type || "application/octet-stream";
  const data = Buffer.from(await file.arrayBuffer());

  await prisma.storedBlob.create({
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

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
