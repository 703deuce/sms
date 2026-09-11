import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveClientPortalSession } from "@/lib/appointments/service-booking";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveClientPortalSession(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired portal session" }, { status: 404 });
    return NextResponse.json({ data: resolved });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Portal sessions must be created through verified customer sign-in" },
    { status: 403 },
  );
}
