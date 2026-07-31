import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { loadTeamMembers } from "@/lib/workspace-data";

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
    const data = await loadTeamMembers(auth.workspaceId);
    return NextResponse.json({ data });
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
      password?: string;
    };
    if (!body.email || !body.name) {
      return NextResponse.json({ error: "name and email required" }, { status: 400 });
    }

    const email = body.email.trim().toLowerCase();
    const role = ROLE_MAP[body.role || "Inbox agent"] || "INBOX_AGENT";
    const prisma = getPrisma();

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await hash(body.password || `Invite-${Date.now()}`, 10);
      user = await prisma.user.create({
        data: {
          email,
          name: body.name.trim(),
          passwordHash,
        },
      });
    }

    const membership = await prisma.membership.upsert({
      where: {
        userId_workspaceId: { userId: user.id, workspaceId: auth.workspaceId },
      },
      create: {
        userId: user.id,
        workspaceId: auth.workspaceId,
        role,
      },
      update: { role },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: auth.workspaceId,
        userId: auth.session.userId,
        event: "team.member_added",
        detail: `${user.email} as ${role}`,
      },
    });

    return NextResponse.json({ data: { membership, user } }, { status: 201 });
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
    const membershipId = searchParams.get("membershipId");
    if (!membershipId) {
      return NextResponse.json({ error: "membershipId required" }, { status: 400 });
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
