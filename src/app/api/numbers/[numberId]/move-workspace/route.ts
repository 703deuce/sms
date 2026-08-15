import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

/** Reassign a phone number to another workspace the user owns (no Telnyx reprovision). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ numberId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { numberId } = await params;
    const body = (await request.json()) as { targetWorkspaceId?: string };

    if (!body.targetWorkspaceId?.trim()) {
      return NextResponse.json({ error: "targetWorkspaceId required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const number = await prisma.phoneNumber.findFirst({
      where: { id: numberId, workspaceId: auth.workspaceId },
    });
    if (!number) {
      return NextResponse.json({ error: "Number not found" }, { status: 404 });
    }

    const targetMembership = await prisma.membership.findUnique({
      where: {
        userId_workspaceId: {
          userId: auth.session.userId,
          workspaceId: body.targetWorkspaceId,
        },
      },
      include: { workspace: { select: { type: true, name: true } } },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const conflict = await prisma.phoneNumber.findFirst({
      where: {
        workspaceId: body.targetWorkspaceId,
        e164: number.e164,
      },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "That number already exists in the target workspace." },
        { status: 409 },
      );
    }

    const updated = await prisma.phoneNumber.update({
      where: { id: number.id },
      data: { workspaceId: body.targetWorkspaceId },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        e164: updated.e164,
        workspaceId: updated.workspaceId,
        targetWorkspaceName: targetMembership.workspace.name,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
