import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

type Params = { params: Promise<{ slug: string }> };

/** Public QR scan redirect — records scan then forwards to consent-aware destination. */
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const qr = await getPrisma().qrCode.findFirst({
    where: { publicSlug: slug, status: "Active" },
  });
  if (!qr) {
    return NextResponse.redirect(new URL("/", process.env.APP_URL || "http://localhost:3000"));
  }
  await getPrisma().qrCode.update({
    where: { id: qr.id },
    data: { scans: { increment: 1 } },
  });
  return NextResponse.redirect(qr.targetUrl, { status: 302 });
}
