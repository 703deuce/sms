import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { loadTeamMembers } from "@/lib/workspace-data";
import { createWorkspaceInvite, loadPendingInvites, cancelInvite } from "@/lib/team/invites";

const ROLE_MAP: Record<string, "OWNER" | "ADMINISTRATOR" | "MANAGER" | "CAMPAIGN_CREATOR" | "INBOX_AGENT" | "ANALYST" | "READ_ONLY"> = {
  Owner: "OWNER",
  Administrator: "ADMINISTRATOR",
  Manager: "MANAGER",
  "Campaign creator": "CAMPAIGN_CREATOR",
  "Inbox agent": "INBOX_AGENT",
  Analyst: "ANALYST",
  "Read only": "READ_ONLY",
  OWNER: "OWNER",
  ADMINISTRATOR: "ADMINISTRATOR",
  MANAGER: "MANAGER",
  CAMPAIGN_CREATOR: "CAMPAIGN_CREATOR",
  INBOX_AGENT: "INBOX_AGENT",
  ANALYST: "ANALYST",
  READ_ONLY: "READ_ONLY",
};

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const [members, invites] = await Promise.all([
      loadTeamMembers(auth.workspaceId),
      loadPendingInvites(auth.workspaceId),
    ]);
    return NextResponse.json({ data: members, invites });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      role?: string;
    };
    if (!body.email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const role = ROLE_MAP[body.role || "Inbox agent"] || "INBOX_AGENT";
    const prisma = getPrisma();

    // If the user already belongs to this workspace, there's nothing to invite.
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const membership = await prisma.membership.findUnique({
        where: {
          userId_workspaceId: { userId: existingUser.id, workspaceId: auth.workspaceId },
        },
      });
      if (membership) {
        return NextResponse.json(
          { error: "That person is already a member of this workspace" },
          { status: 409 },
        );
      }
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { name: true, displayName: true },
    });

    const { invite, url, emailStatus, emailProvider } = await createWorkspaceInvite({
      workspaceId: auth.workspaceId,
      email,
      role,
      invitedById: auth.session.userId,
      workspaceName: workspace?.displayName || workspace?.name,
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: auth.workspaceId,
        userId: auth.session.userId,
        event: "team.invite_sent",
        detail: `${email} as ${role}`,
      },
    });

    return NextResponse.json(
      {
        data: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
        },
        // Surface the accept URL so the UI can copy it (useful when email is stubbed).
        inviteUrl: emailProvider === "stub" || emailStatus === "failed" ? url : undefined,
      },
      { status: 201 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      membershipId?: string;
      role?: string;
    };
    if (!body.membershipId || !body.role) {
      return NextResponse.json({ error: "membershipId and role required" }, { status: 400 });
    }
    const role = ROLE_MAP[body.role];
    if (!role) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    const membership = await getPrisma().membership.update({
      where: { id: body.membershipId },
      data: { role },
    });
    if (membership.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ data: membership });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);

    const inviteId = searchParams.get("inviteId");
    if (inviteId) {
      const result = await cancelInvite(auth.workspaceId, inviteId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    const membershipId = searchParams.get("membershipId");
    if (!membershipId) {
      return NextResponse.json({ error: "membershipId or inviteId required" }, { status: 400 });
    }
    const membership = await getPrisma().membership.findUnique({
      where: { id: membershipId },
    });
    if (!membership || membership.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await getPrisma().membership.delete({ where: { id: membershipId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
