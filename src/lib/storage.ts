import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Local disk storage for the demo. In production this becomes Azure Blob
 * Storage with private containers and short-lived SAS URLs; nothing outside
 * this file knows where the bytes actually live, so that swap is a one-file
 * change. Registry extracts and passports must never sit in a public bucket.
 */

const ROOT = path.join(process.cwd(), "storage");

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

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

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
  const key = `${folder}/${randomUUID()}_${safeName}`;
  const target = path.join(ROOT, key);
  await ensureDir(path.dirname(target));
  await writeFile(target, Buffer.from(await file.arrayBuffer()));
  return {
    storageKey: key,
    fileName: safeName,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
}

export async function readStored(key: string): Promise<Buffer | null> {
  const target = path.join(ROOT, key);
  if (!target.startsWith(ROOT)) return null; // path traversal guard
  try {
    await stat(target);
    return await readFile(target);
  } catch {
    return null;
  }
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
