import { createDemoSession, SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/auth";
import { workspaces } from "@/lib/mock/data";
import { NextResponse } from "next/server";

async function resolveWorkspaceId() {
  try {
    const { getPrisma } = await import("@/lib/db");
    const ws = await getPrisma().workspace.findUnique({ where: { slug: "harbor-home" } });
    if (ws) return ws.id;
  } catch {
    // Demo UI without DB — fall through to mock id
  }
  return workspaces[0].id;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const session = createDemoSession(body.email);
  const workspaceId = await resolveWorkspaceId();
  const res = NextResponse.json({ ok: true, workspaceId });
  res.cookies.set(SESSION_COOKIE, encodeURIComponent(JSON.stringify(session)), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
  res.cookies.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
