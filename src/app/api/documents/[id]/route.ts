import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { readStored } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";


// Serves per-request, authorised content; never cache or prerender it.
export const dynamic = "force-dynamic";

/**
 * `filename=` does not decode percent escapes, so non-ASCII names go in
 * `filename*` (RFC 6266 / RFC 5987) with a plain ASCII fallback beside it.
 */
function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Member documents are served through the application, never from a public
 * path. Only an administrator, or someone from the company that uploaded it,
 * may read a registry extract or a passport scan - and every read is logged.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const doc = await prisma.companyDocument.findUnique({ where: { id } });
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const allowed = user.role === "ADMIN" || user.companyId === doc.companyId;
  if (!allowed) return new NextResponse("Forbidden", { status: 403 });

  const bytes = await readStored(doc.storageKey);
  if (!bytes) {
    return new NextResponse(
      "この書類はデモ用のプレースホルダで、実ファイルは保存されていません。",
      { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  await writeAudit({
    actorUserId: user.id,
    actorLabel: user.name,
    action: "ADMIN_ACTION",
    targetType: "CompanyDocument",
    targetId: doc.id,
    summary: `${doc.kind} を閲覧しました`,
  });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": doc.mimeType,
      "content-disposition": contentDisposition(doc.fileName),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
