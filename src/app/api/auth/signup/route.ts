import { createDemoSession, SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/auth";
import { workspaces } from "@/lib/mock/data";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
    businessName?: string;
  };
  if (!body.email || !body.password || !body.name) {
    return NextResponse.json({ error: "Name, email, and password required" }, { status: 400 });
  }

  const session = createDemoSession(body.email, body.name);
  const res = NextResponse.json({ ok: true, workspace: body.businessName || workspaces[0].name });
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
