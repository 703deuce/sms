import { NextResponse } from "next/server";
import { WORKSPACE_COOKIE } from "@/lib/auth";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { loadShellData } from "@/lib/workspace-data";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadShellData(auth.session.userId, auth.workspaceId);
    return NextResponse.json({
      data: {
        workspaceId: auth.workspaceId,
        ...data,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      workspaceId?: string;
      name?: string;
      action?: string;
    };

    if (body.action === "create" && body.name?.trim()) {
      const slugBase = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 40) || "workspace";
      let slug = slugBase;
      const taken = await getPrisma().workspace.findUnique({ where: { slug } });
      if (taken) slug = `${slug}-${Date.now().toString(36)}`;

      const workspace = await getPrisma().workspace.create({
        data: {
          name: body.name.trim(),
          slug,
          memberships: {
            create: { userId: auth.session.userId, role: "OWNER" },
          },
          messagingRegistration: { create: {} },
        },
      });
      const res = NextResponse.json({ data: workspace }, { status: 201 });
      res.cookies.set(WORKSPACE_COOKIE, workspace.id, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
      });
      return res;
    }

    if (!body.workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const membership = await getPrisma().membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: auth.session.userId,
          workspaceId: body.workspaceId,
        },
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true, workspaceId: body.workspaceId });
    res.cookies.set(WORKSPACE_COOKIE, body.workspaceId, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { name?: string };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const workspace = await getPrisma().workspace.update({
      where: { id: auth.workspaceId },
      data: { name: body.name.trim() },
    });
    return NextResponse.json({ data: workspace });
  } catch (err) {
    return jsonError(err, 400);
  }
}
