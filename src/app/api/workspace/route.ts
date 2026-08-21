import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { loadShellData } from "@/lib/workspace-data";
import { createWorkspaceForUser } from "@/lib/workspace/create-workspace";
import { applyWorkspaceCookies } from "@/lib/workspace/cookies";
import type { WorkspaceType } from "@/lib/workspace/types";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const data = await loadShellData(auth.session.userId, auth.workspaceId);
    const workspace = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { type: true, displayName: true, name: true },
    });
    return NextResponse.json({
      data: {
        workspaceId: auth.workspaceId,
        workspaceType: workspace?.type ?? "BUSINESS",
        workspaceName: workspace?.displayName || workspace?.name,
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
      type?: WorkspaceType;
    };

    if (body.action === "create" && body.name?.trim()) {
      const workspaceType: WorkspaceType =
        body.type === "PERSONAL" ? "PERSONAL" : "BUSINESS";
      const workspace = await createWorkspaceForUser(
        auth.session.userId,
        body.name.trim(),
        workspaceType,
      );
      const res = NextResponse.json({ data: workspace }, { status: 201 });
      applyWorkspaceCookies(res, workspace.id, workspaceType);
      return res;
    }

    if (body.action === "create_personal") {
      const existing = await getPrisma().workspace.findFirst({
        where: {
          ownerUserId: auth.session.userId,
          type: "PERSONAL",
        },
      });
      if (existing) {
        const membership = await getPrisma().membership.findUnique({
          where: {
            userId_workspaceId: {
              userId: auth.session.userId,
              workspaceId: existing.id,
            },
          },
        });
        if (!membership) {
          await getPrisma().membership.create({
            data: {
              userId: auth.session.userId,
              workspaceId: existing.id,
              role: "OWNER",
            },
          });
        }
        const res = NextResponse.json({ data: existing });
        applyWorkspaceCookies(res, existing.id, "PERSONAL");
        return res;
      }
      const workspace = await createWorkspaceForUser(
        auth.session.userId,
        "Personal",
        "PERSONAL",
      );
      const res = NextResponse.json({ data: workspace }, { status: 201 });
      applyWorkspaceCookies(res, workspace.id, "PERSONAL");
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
      include: { workspace: { select: { type: true } } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const res = NextResponse.json({
      ok: true,
      workspaceId: body.workspaceId,
      workspaceType: membership.workspace.type,
    });
    applyWorkspaceCookies(
      res,
      body.workspaceId,
      membership.workspace.type === "PERSONAL" ? "PERSONAL" : "BUSINESS",
    );
    return res;
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      name?: string;
      activeFromNumberId?: string | null;
    };

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json({ error: "name required" }, { status: 400 });
      }
      data.name = body.name.trim();
    }

    if (body.activeFromNumberId !== undefined) {
      if (body.activeFromNumberId) {
        // Ensure the number belongs to this workspace before persisting it.
        const owned = await getPrisma().phoneNumber.findFirst({
          where: { id: body.activeFromNumberId, workspaceId: auth.workspaceId },
        });
        if (!owned) {
          return NextResponse.json({ error: "Unknown phone number" }, { status: 400 });
        }
      }
      data.activeFromNumberId = body.activeFromNumberId || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const workspace = await getPrisma().workspace.update({
      where: { id: auth.workspaceId },
      data,
    });
    return NextResponse.json({ data: workspace });
  } catch (err) {
    return jsonError(err, 400);
  }
}
