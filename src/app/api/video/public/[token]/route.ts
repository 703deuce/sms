import { NextResponse } from "next/server";
import { getPublicMeetingInfo } from "@/lib/transovo-video/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const info = await getPublicMeetingInfo(token);
  if (!info) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  return NextResponse.json({ data: info });
}
