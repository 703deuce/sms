import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { dialOutboundCall } from "./telnyx/assistant-sync";
import { getPublishedConfig } from "./agent-service";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function initiateOutboundCall(input: {
  workspaceId: string;
  agentId: string;
  toPhone: string;
  contactId?: string;
  campaignId?: string;
  isTest?: boolean;
  dynamicVariables?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  if (agent.status !== "ACTIVE" && agent.status !== "TESTING") {
    throw new Error("Agent is not active");
  }

  const phone = normalizeE164(input.toPhone);

  // Compliance checks
  const compliance = await prisma.voiceComplianceProfile.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  if (compliance?.emergencyStop) {
    throw new Error("Voice emergency stop is active");
  }

  const suppressed = await prisma.suppression.findFirst({
    where: { workspaceId: input.workspaceId, phone },
  });
  if (suppressed) {
    throw new Error("Number is on suppression list");
  }

  let fromE164 = "";
  let phoneNumberId: string | null = agent.phoneNumberId;

  if (phoneNumberId) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId: input.workspaceId },
    });
    fromE164 = pn?.e164 || "";
  }
  if (!fromE164) {
    const pn = await prisma.phoneNumber.findFirst({
      where: { workspaceId: input.workspaceId, status: "Active" },
    });
    fromE164 = pn?.e164 || "";
    phoneNumberId = pn?.id || null;
  }
  if (!fromE164) throw new Error("No outbound caller ID configured");

  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: agent.id,
      agentVersionId: agent.publishedVersionId,
      contactId: input.contactId,
      campaignId: input.campaignId,
      direction: "OUTBOUND",
      status: "QUEUED",
      fromE164,
      toE164: phone,
      phoneNumberId,
      isTest: input.isTest ?? false,
      dynamicVariables: input.dynamicVariables as object,
    },
  });

  const config = await getPublishedConfig(agent.id);

  const dial = await dialOutboundCall({
    workspaceId: input.workspaceId,
    callId: call.id,
    fromE164,
    toE164: phone,
    assistantId: agent.telnyxAssistantId,
    connectionId: agent.telnyxConnectionId,
  });

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      telnyxCallControlId: dial.callControlId,
      status: "INITIATED",
    },
  });

  return { call, dial };
}

export async function processVoiceCampaignBatch() {
  const prisma = getPrisma();
  const campaigns = await prisma.voiceCampaign.findMany({
    where: { status: "RUNNING" },
    take: 10,
  });

  let initiated = 0;
  for (const campaign of campaigns) {
    const running = await prisma.voiceCall.count({
      where: {
        campaignId: campaign.id,
        status: { in: ["QUEUED", "INITIATED", "RINGING", "ANSWERED", "IN_PROGRESS"] },
      },
    });
    if (running >= campaign.concurrency) continue;

    const contact = await prisma.voiceCampaignContact.findFirst({
      where: { campaignId: campaign.id, status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    if (!contact) {
      await prisma.voiceCampaign.update({
        where: { id: campaign.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      continue;
    }

    try {
      const c = contact.contactId
        ? await prisma.contact.findUnique({ where: { id: contact.contactId } })
        : null;

      await initiateOutboundCall({
        workspaceId: campaign.workspaceId,
        agentId: campaign.agentId,
        toPhone: contact.phone,
        contactId: contact.contactId,
        campaignId: campaign.id,
        dynamicVariables: (contact.variables as Record<string, unknown>) || {},
      });

      await prisma.voiceCampaignContact.update({
        where: { id: contact.id },
        data: { status: "in_progress", attemptCount: { increment: 1 } },
      });
      initiated += 1;
    } catch (err) {
      await prisma.voiceCampaignContact.update({
        where: { id: contact.id },
        data: {
          status: "failed",
          lastOutcome: err instanceof Error ? err.message : "failed",
        },
      });
    }
  }

  return { initiated };
}

export async function completeMockCall(callId: string) {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call) return;

  await prisma.voiceCall.update({
    where: { id: callId },
    data: {
      status: "COMPLETED",
      answeredAt: new Date(),
      endedAt: new Date(),
      durationSeconds: 45,
      outcome: "completed",
    },
  });

  await prisma.voiceTranscript.create({
    data: {
      workspaceId: call.workspaceId,
      callId: call.id,
      provider: "telnyx",
      status: "completed",
      fullText: "Mock call transcript for testing.",
      language: "en-US",
    },
  });

  const { processPostCall } = await import("./post-call");
  await processPostCall(callId);
}
