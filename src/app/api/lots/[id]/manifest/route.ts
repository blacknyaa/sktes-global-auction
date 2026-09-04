import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { buildManifestWorkbook } from "@/lib/manifest";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { id } = await params;
  const lot = await prisma.lot.findUnique({
    where: { id },
    include: { items: { orderBy: { lineNo: "asc" } } },
  });
  if (!lot) return new NextResponse("Not found", { status: 404 });

  // Drafts belong to their owner until published.
  if (
    lot.status === "DRAFT" &&
    user.role !== "ADMIN" &&
    user.companyId !== lot.sellerCompanyId
  ) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const buffer = await buildManifestWorkbook(
    lot.lotNumber,
    lot.title,
    lot.items.map((i) => ({
      lineNo: i.lineNo,
      maker: i.maker,
      model: i.model,
      cpu: i.cpu,
      ramGb: i.ramGb,
      storage: i.storage,
      gpu: i.gpu,
      screen: i.screen,
      grade: i.grade,
      quantity: i.quantity,
      note: i.note,
    }))
  );

  return new NextResponse(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${lot.lotNumber}_manifest.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}
