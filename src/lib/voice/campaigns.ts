import { getPrisma } from "@/lib/db";
import { createHmac, randomBytes } from "crypto";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

export async function enrollCampaignAudience(
  workspaceId: string,
  campaignId: string,
  audience: {
    listId?: string;
    segmentId?: string;
    phones?: string[];
    excludeResponders?: boolean;
    requireConsent?: boolean;
  },
) {
  const prisma = getPrisma();
  const campaign = await prisma.voiceCampaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  const phones = new Set<string>();

  if (audience.listId) {
    const members = await prisma.contactListMember.findMany({
      where: { listId: audience.listId },
    });
    for (const m of members) {
      const c = await prisma.contact.findUnique({ where: { id: m.contactId } });
      if (c?.phone) phones.add(c.phone);
    }
  }

  if (audience.phones?.length) {
    for (const p of audience.phones) phones.add(p);
  }

  let enrolled = 0;
  for (const phone of phones) {
    const suppressed = await prisma.suppression.findFirst({
      where: { workspaceId, phone },
    });
    if (suppressed) continue;

    let contactId: string | null = null;
    const contact = await prisma.contact.findUnique({
      where: { workspaceId_phone: { workspaceId, phone } },
    });
    if (contact) {
      contactId = contact.id;
      if (audience.requireConsent && contact.status !== "SUBSCRIBED") continue;
      if (audience.excludeResponders) {
        const prior = await prisma.voiceCampaignContact.findFirst({
          where: {
            campaignId,
            phone,
            status: { in: ["completed", "qualified"] },
          },
        });
        if (prior) continue;
      }
    }

    try {
      await prisma.voiceCampaignContact.create({
        data: {
          workspaceId,
          campaignId,
          phone,
          contactId,
          status: "pending",
        },
      });
      enrolled += 1;
    } catch {
      // duplicate phone in campaign
    }
  }

  await prisma.voiceCampaign.update({
    where: { id: campaignId },
    data: { totalContacts: { increment: enrolled }, audienceConfig: audience as object },
  });

  return { enrolled };
}

export async function startCampaign(workspaceId: string, campaignId: string) {
  const prisma = getPrisma();
  const campaign = await prisma.voiceCampaign.findFirst({
    where: { id: campaignId, workspaceId },
  });
  if (!campaign) throw new Error("Campaign not found");

  const compliance = await prisma.voiceComplianceProfile.findUnique({
    where: { workspaceId },
  });
  if (compliance?.emergencyStop) throw new Error("Emergency stop active");

  const pending = await prisma.voiceCampaignContact.count({
    where: { campaignId, status: "pending" },
  });
  if (!pending) throw new Error("No contacts enrolled. Add audience first.");

  await prisma.voiceCampaign.update({
    where: { id: campaignId },
    data: { status: "RUNNING", startedAt: new Date() },
  });
  return { ok: true, pending };
}

export async function pauseCampaign(workspaceId: string, campaignId: string) {
  await getPrisma().voiceCampaign.updateMany({
    where: { id: campaignId, workspaceId },
    data: { status: "PAUSED" },
  });
  return { ok: true };
}

export async function applyVoicemailPolicy(
  workspaceId: string,
  callId: string,
  campaignId: string,
) {
  const prisma = getPrisma();
  const campaign = await prisma.voiceCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return;

  const rules = (campaign.voicemailRules || {}) as Record<string, unknown>;
  const action = String(rules.action || "hangup");

  await prisma.voiceCall.update({
    where: { id: callId },
    data: { voicemailDetected: true, outcome: "voicemail" },
  });

  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call) return;

  const contact = await prisma.voiceCampaignContact.findFirst({
    where: { campaignId, phone: call.toE164 },
  });
  if (contact) {
    const maxAttempts = campaign.maxAttempts || 3;
    const nextStatus =
      contact.attemptCount >= maxAttempts ? "max_attempts" : "pending";
    await prisma.voiceCampaignContact.update({
      where: { id: contact.id },
      data: {
        status: nextStatus,
        lastOutcome: "voicemail",
      },
    });

    if (action === "sms_followup" && rules.smsBody) {
      const { sendQuickSms } = await import("@/lib/sms/send-quick");
      await sendQuickSms({
        workspaceId,
        to: call.toE164,
        body: String(rules.smsBody),
      }).catch(() => undefined);
    }
  }
}
