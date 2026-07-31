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

      // Best-effort provider release of the registered number.
      try {
        const { messagingOnboarding } = await import("@/lib/messaging/service");
        await messagingOnboarding.releaseNumber(workspaceId);
      } catch {
        // No number to release, or provider unavailable — continue.
      }

      // Mark any remaining active numbers as released in our records.
      const activeNumbers = await prisma.phoneNumber.findMany({
        where: { workspaceId, status: { not: "Released" } },
      });
      if (activeNumbers.length) {
        await prisma.phoneNumber.updateMany({
          where: { workspaceId, status: { not: "Released" } },
          data: { status: "Released", releasedAt: now },
        });
        releasedNumbers += activeNumbers.length;
      }

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
