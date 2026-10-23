import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import {
  getMembershipForUser,
  isPowerDialerAdminRole,
  listWorkspaceReps,
} from "@/lib/server/phone/power-dialer/campaign-access";
import { getPrisma } from "@/lib/server/db";
import { updatePowerDialerSettings } from "@/lib/server/phone/power-dialer";
import { resolveInternalUserId } from "@/lib/server/internal-user";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { parseExtendedConfig } from "@/lib/server/phone/power-dialer/campaign-extended-config";

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
    const settings = await import("@/lib/server/phone/power-dialer").then((m) =>
      m.getPowerDialerSettings(workspaceId),
    );
    return NextResponse.json({
      data: { reps, campaignAssignments: assignments, settings },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const userId = await resolveInternalUserId();
    const membership = await getMembershipForUser(workspaceId, userId);
    if (!membership || !isPowerDialerAdminRole(membership.role)) {
      throw new Error("Admin role required to edit team settings");
    }
    const body = (await request.json()) as Record<string, unknown>;
    const prisma = getPrisma();

    if (body.action === "update_campaign_access" && typeof body.campaignId === "string") {
      const campaign = await prisma.powerDialerCampaign.findFirst({
        where: { id: body.campaignId, workspaceId },
      });
      if (!campaign) throw new Error("Campaign not found");
      const ext = parseExtendedConfig(campaign.configJson);
      const memberUserIds = Array.isArray(body.memberUserIds)
        ? body.memberUserIds.map(String)
        : ext.memberUserIds;
      const ownerUserId =
        typeof body.ownerUserId === "string" ? body.ownerUserId : ext.ownerUserId;
      await prisma.powerDialerCampaign.update({
        where: { id: campaign.id },
        data: {
          configJson: {
            ...(campaign.configJson as object),
            memberUserIds,
            ownerUserId,
          },
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update_team_settings") {
      const next = await updatePowerDialerSettings(workspaceId, {
        teamActivityVisibility:
          body.teamActivityVisibility === "assigned_only" ? "assigned_only" : "all_reps",
        repNumberAssignments:
          body.repNumberAssignments && typeof body.repNumberAssignments === "object"
            ? (body.repNumberAssignments as Record<string, string[]>)
            : undefined,
      });
      return NextResponse.json({ data: next });
    }

    throw new Error("Unknown action");
  } catch (err) {
    return jsonError(err, 400);
  }
}
