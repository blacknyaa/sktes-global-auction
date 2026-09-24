import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildTemplateWorkbook } from "@/lib/manifest";
import { contentDisposition } from "@/lib/storage";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  // The workbook is for sellers preparing a lot. Bidders and other roles do
  // not need it, and the route was open to any signed-in account.
  if (user.role !== "SELLER" && user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const buffer = await buildTemplateWorkbook();
  return new NextResponse(buffer, {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": contentDisposition(
        "sktes_lot_manifest_template.xlsx"
      ),
      "cache-control": "private, no-store",
    },
  });
}
