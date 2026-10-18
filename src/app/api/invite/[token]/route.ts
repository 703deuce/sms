import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { WORKSPACE_COOKIE } from "@/lib/auth";
import { applySessionCookie } from "@/lib/auth/session-cookie";
import { getPrisma } from "@/lib/db";
import { getInviteByToken } from "@/lib/team/invites";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = await getInviteByToken(token);

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }
  if (result.status === "accepted") {
    return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 });
  }
  if (result.status === "expired") {
    return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
  }

  const prisma = getPrisma();
  const existingUser = await prisma.user.findUnique({
    where: { email: result.invite.email },
    select: { id: true, passwordHash: true },
  });

  return NextResponse.json({
    data: {
      email: result.invite.email,
      role: result.invite.role,
      workspaceName: result.workspace?.displayName || result.workspace?.name || "the workspace",
      isExistingUser: Boolean(existingUser?.passwordHash),
    },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const result = await getInviteByToken(token);

    if (result.status === "not_found") {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }
    if (result.status === "accepted") {
      return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 });
    }
    if (result.status === "expired") {
      return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
    }

    const invite = result.invite;
    const body = (await request.json()) as { name?: string; password?: string };
    const prisma = getPrisma();

    let user = await prisma.user.findUnique({ where: { email: invite.email } });

    if (user?.passwordHash) {
      // Existing account: authenticate before joining.
      if (!body.password || !(await compare(body.password, user.passwordHash))) {
        return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
      }
    } else {
      // New account (or one without a password yet): create/set credentials.
      if (!body.password || body.password.length < 8) {
        return NextResponse.json(
          { error: "Password must be at least 8 characters" },
          { status: 400 },
        );
      }
      const passwordHash = await hash(body.password, 10);
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash, name: body.name?.trim() || user.name },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: invite.email,
            name: body.name?.trim() || invite.email.split("@")[0],
            passwordHash,
          },
        });
      }
    }

    await prisma.membership.upsert({
      where: {
        userId_workspaceId: { userId: user.id, workspaceId: invite.workspaceId },
      },
      create: {
        userId: user.id,
        workspaceId: invite.workspaceId,
        role: invite.role,
      },
      update: { role: invite.role },
    });

    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        event: "team.invite_accepted",
        detail: `${user.email} joined as ${invite.role}`,
      },
    });

    const session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      isAdmin: user.isPlatformAdmin,
    };

    const res = NextResponse.json({ ok: true, workspaceId: invite.workspaceId });
    applySessionCookie(res, session);
    res.cookies.set(WORKSPACE_COOKIE, invite.workspaceId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch (err) {
    console.error("[invite/accept]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to accept invite" },
      { status: 400 },
    );
  }
}
