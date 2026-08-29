import { NextResponse } from "next/server";
import { recordTapToJoinClick } from "@/lib/growth/tap-to-join";

type Params = { params: Promise<{ slug: string }> };

/** Public Tap-to-Join redirect — records click then opens SMS composer. */
export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const link = await recordTapToJoinClick(slug);
  if (!link || link.status !== "Active") {
    return NextResponse.redirect(new URL("/", process.env.APP_URL || "http://localhost:3000"));
  }
  return NextResponse.redirect(link.href, { status: 302 });
}
