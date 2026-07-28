import { createDemoSession, SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/auth";
import { workspaces } from "@/lib/mock/data";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const session = createDemoSession(body.email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify(session)), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
  res.cookies.set(WORKSPACE_COOKIE, workspaces[0].id, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
