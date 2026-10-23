import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

async function loadScript(workspaceId: string, id: string) {
  const prisma = getPrisma();
  const row = await prisma.powerDialerScript.findFirst({
    where: { id, workspaceId, archivedAt: null },
  });
  if (!row) throw new Error("Script not found");
  return row;
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      name?: string;
      body?: string;
      isDefault?: boolean;
      assignmentJson?: unknown;
      action?: "archive" | "clone";
    };
    const prisma = getPrisma();
    const existing = await loadScript(workspaceId, id);

    if (body.action === "archive") {
      const data = await prisma.powerDialerScript.update({
        where: { id: existing.id },
        data: { archivedAt: new Date(), isDefault: false },
      });
      return NextResponse.json({ data });
    }

    if (body.action === "clone") {
      const data = await prisma.powerDialerScript.create({
        data: {
          workspaceId,
          name: `${existing.name} (copy)`,
          body: existing.body,
          isDefault: false,
        },
      });
      return NextResponse.json({ data });
    }

    if (body.isDefault) {
      await prisma.powerDialerScript.updateMany({
        where: { workspaceId },
        data: { isDefault: false },
      });
    }

    const data = await prisma.powerDialerScript.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() || existing.name } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.isDefault !== undefined ? { isDefault: body.isDefault } : {}),
        ...(body.assignmentJson !== undefined
          ? { assignmentJson: body.assignmentJson as import("@prisma/client").Prisma.InputJsonValue }
          : {}),
      },
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(_request);
  if (denied) return denied;
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const existing = await loadScript(workspaceId, id);
    await prisma.powerDialerScript.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
