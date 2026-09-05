import { NextResponse } from "next/server";
import { JoinAccessError, requestVideoJoin } from "@/lib/transovo-video/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const body = await request.json().catch(() => ({}));

  try {
    const result = await requestVideoJoin({
      publicMeetingToken: token,
      displayName: String(body.displayName || "").trim(),
      email: body.email ? String(body.email) : undefined,
      passcode: body.passcode ? String(body.passcode) : undefined,
      userId: body.userId ? String(body.userId) : undefined,
      isStaffHost: Boolean(body.isStaffHost),
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof JoinAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 403 });
    }
    console.error("[video/join]", err);
    return NextResponse.json({ error: "Unable to join meeting" }, { status: 500 });
  }
}
