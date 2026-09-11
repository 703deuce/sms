import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  getClientPortalSessionFromCookies,
  requireClientPortalSession,
} from "@/lib/appointments/client-portal/auth";
import { buildClientPortalWorkspace } from "@/lib/appointments/client-portal/workspace";
import { clientPortalClearCookieHeader } from "@/lib/appointments/client-portal/cookie";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireClientPortalSession(request);
    const data = await buildClientPortalWorkspace(ctx);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE() {
  const ctx = await getClientPortalSessionFromCookies();
  const res = NextResponse.json({ data: { ok: true } });
  res.headers.set("Set-Cookie", clientPortalClearCookieHeader());
  if (ctx) {
    const { getPrisma } = await import("@/lib/db");
    await getPrisma().clientPortalSession.delete({ where: { id: ctx.sessionId } }).catch(() => undefined);
  }
  return res;
}
