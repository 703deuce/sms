import { WORKSPACE_COOKIE } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { workspaceId?: string };
  if (!body.workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(WORKSPACE_COOKIE, body.workspaceId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
