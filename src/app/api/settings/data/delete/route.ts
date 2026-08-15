import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        { error: "Type DELETE to confirm account deletion" },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    const now = new Date();

    // Flag the user account for deletion.
    await prisma.user.update({
      where: { id: auth.session.userId },
      data: { deletionRequestedAt: now },
    });

    // Workspaces this user owns are flagged and their numbers released.
    const ownerMemberships = await prisma.membership.findMany({
      where: { userId: auth.session.userId, role: "OWNER" },
    });

    let releasedNumbers = 0;
    for (const membership of ownerMemberships as Array<{ workspaceId: string }>) {
      const workspaceId = membership.workspaceId;

      const { releaseAllWorkspaceNumbers } = await import("@/lib/numbers/release-service");
      const releaseResult = await releaseAllWorkspaceNumbers(workspaceId);
      releasedNumbers += releaseResult.released;

      await prisma.auditLog.create({
        data: {
          workspaceId,
          userId: auth.session.userId,
          event: "workspace.deletion_requested",
          detail: `Deletion requested by owner ${auth.session.email}`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      deletionRequestedAt: now.toISOString(),
      workspacesFlagged: ownerMemberships.length,
      releasedNumbers,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
