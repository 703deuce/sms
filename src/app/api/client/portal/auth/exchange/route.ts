import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveClientPortalSession } from "@/lib/appointments/service-booking";
import { clientPortalSetCookieHeader } from "@/lib/appointments/client-portal/cookie";

/** Exchange a legacy `/portal/{token}` link for an httpOnly session cookie. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = String(body.token || "").trim();
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });
    const resolved = await resolveClientPortalSession(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
    const res = NextResponse.json({ data: { ok: true } });
    res.headers.set("Set-Cookie", clientPortalSetCookieHeader(token));
    return res;
  } catch (err) {
    return jsonError(err, 400);
  }
}
