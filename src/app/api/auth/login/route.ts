import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const ok = await compare(body.password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "No workspace for this account" }, { status: 403 });
    }

    const session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isPlatformAdmin,
    };

    const res = NextResponse.json({
      ok: true,
      workspaceId: membership.workspaceId,
      workspace: membership.workspace.name,
    });
    res.cookies.set(SESSION_COOKIE, encodeSession(session), {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    res.cookies.set(WORKSPACE_COOKIE, membership.workspaceId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed" },
      { status: 500 },
    );
  }
}
