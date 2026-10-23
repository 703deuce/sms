import { getPrisma } from "@/lib/server/db";
import { parseExtendedConfig } from "./campaign-extended-config";

/** P20 / M49 — resolve callback assignee from campaign routing mode. */
export async function resolveCallbackAssignment(input: {
  workspaceId: string;
  campaignId: string;
  contactId: string;
  preferredRepUserId?: string | null;
}): Promise<{
  assignedUserId: string | null;
  visibility: string;
  routingPool: string | null;
  reason: string;
}> {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");
  const ext = parseExtendedConfig(campaign.configJson);
  const mode = ext.callbackRoutingMode || "same_rep";

  if (mode === "same_rep" && input.preferredRepUserId) {
    return {
      assignedUserId: input.preferredRepUserId,
      visibility: "personal",
      routingPool: null,
      reason: "same_rep",
    };
  }

  if (mode === "external" && ext.callbackRoutingE164) {
    return {
      assignedUserId: null,
      visibility: "team",
      routingPool: `external:${ext.callbackRoutingE164}`,
      reason: "external_destination",
    };
  }

  if (mode === "ai_receptionist") {
    return {
      assignedUserId: null,
      visibility: "team",
      routingPool: "ai_receptionist",
      reason: "ai_receptionist",
    };
  }

  if (mode === "best_eligible" || mode === "group") {
    const members = ext.memberUserIds || [];
    if (members.length) {
      const contact = await prisma.contact.findFirst({
        where: { id: input.contactId },
        select: { assignedUserId: true },
      });
      if (contact?.assignedUserId && members.includes(contact.assignedUserId)) {
        return {
          assignedUserId: contact.assignedUserId,
          visibility: mode === "group" ? "team" : "personal",
          routingPool: mode === "group" ? "campaign_group" : null,
          reason: "contact_owner_in_group",
        };
      }
      const idx =
        Math.abs(input.contactId.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) %
        members.length;
      return {
        assignedUserId: members[idx],
        visibility: mode === "group" ? "team" : "personal",
        routingPool: mode === "group" ? "campaign_group" : null,
        reason: "round_robin_group",
      };
    }
  }

  return {
    assignedUserId: input.preferredRepUserId || null,
    visibility: input.preferredRepUserId ? "personal" : "team",
    routingPool: null,
    reason: "default",
  };
}
