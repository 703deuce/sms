import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { listWorkspaceReps } from "@/lib/server/phone/power-dialer/campaign-access";
import { getPrisma } from "@/lib/server/db";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const prisma = getPrisma();
    const reps = await listWorkspaceReps(workspaceId);
    const campaigns = await prisma.powerDialerCampaign.findMany({
      where: { workspaceId },
      select: { id: true, name: true, configJson: true },
    });
    const assignments = campaigns.map((c) => {
      const cfg = (c.configJson || {}) as { ownerUserId?: string; memberUserIds?: string[] };
      return {
        campaignId: c.id,
        campaignName: c.name,
        ownerUserId: cfg.ownerUserId ?? null,
        memberUserIds: cfg.memberUserIds ?? [],
      };
    });
    return NextResponse.json({ data: { reps, campaignAssignments: assignments } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
