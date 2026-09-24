/**
 * Two-workspace isolation fixture — ALPHA PLUMBING (A) vs BETA ELECTRIC (B).
 * Not ws_1. Cleanup via deleteTenantIsoFixture().
 */
import { getPrisma } from "../../src/lib/db";
import { mergeCallHandlingIntoSettings } from "../../src/lib/call-handling/phone-settings";
import { readCallHandlingBlock } from "../../src/lib/call-handling/phone-settings";

export const TENANT_ISO_CONSUMER_E164 = "+15550100999";

export type TenantIsoFixture = {
  slugA: string;
  slugB: string;
  workspaceAId: string;
  workspaceBId: string;
  phoneAId: string;
  phoneBId: string;
  phoneAE164: string;
  phoneBE164: string;
  contactAId: string;
  contactBId: string;
  conversationAId: string;
  conversationBId: string;
  messageAId: string;
  missedCallAId: string;
  missedCallBId: string;
  voiceAgentAId: string;
  voiceAgentBId: string;
  voiceCallAId: string;
  knowledgeAId: string;
};

function brainPayload(businessName: string, service: string) {
  return {
    businessBrain: {
      businessName,
      services: [{ name: service }],
      locations: [{ name: `${businessName} HQ` }],
      knowledgeFacts: [],
    },
  };
}

function e164ForSuffix(suffix: number): string {
  return `+1555010${String(suffix).padStart(4, "0")}`;
}

export async function createTenantIsoFixture(): Promise<TenantIsoFixture> {
  const prisma = getPrisma();
  const token = `${Date.now()}`;
  const slugA = `tenant-iso-alpha-${token}`;
  const slugB = `tenant-iso-beta-${token}`;

  const wsA = await prisma.workspace.create({
    data: {
      name: "ALPHA PLUMBING",
      slug: slugA,
      type: "BUSINESS",
      customFieldsConfig: brainPayload("ALPHA PLUMBING", "Drain Cleaning"),
    },
  });
  const wsB = await prisma.workspace.create({
    data: {
      name: "BETA ELECTRIC",
      slug: slugB,
      type: "BUSINESS",
      customFieldsConfig: brainPayload("BETA ELECTRIC", "Panel Replacement"),
    },
  });

  const phoneAE164 = e164ForSuffix(1);
  const phoneBE164 = e164ForSuffix(2);

  const mctbSettings = (label: string) =>
    mergeCallHandlingIntoSettings(
      {},
      {
        activeCallHandler: "mctb",
        parkedAiReceptionistAgentId: null,
        explicitSelectionAt: new Date().toISOString(),
        lastSwitchAt: new Date().toISOString(),
        lastSwitchByUserId: null,
      },
    );

  const phoneA = await prisma.phoneNumber.create({
    data: {
      workspaceId: wsA.id,
      e164: phoneAE164,
      type: "Toll-free",
      status: "Active",
      providerNumberId: `mock-prov-a-${token}`,
      settingsJson: { ...mctbSettings("A"), label: "A_INGRESS" } as object,
    },
  });
  const phoneB = await prisma.phoneNumber.create({
    data: {
      workspaceId: wsB.id,
      e164: phoneBE164,
      type: "Toll-free",
      status: "Active",
      providerNumberId: `mock-prov-b-${token}`,
      settingsJson: { ...mctbSettings("B"), label: "B_INGRESS" } as object,
    },
  });

  await prisma.missedCallTextConfig.create({
    data: {
      workspaceId: wsA.id,
      phoneNumberId: phoneA.id,
      enabled: true,
      messageTemplate: "ALPHA recovery opener",
    },
  });
  await prisma.missedCallTextConfig.create({
    data: {
      workspaceId: wsB.id,
      phoneNumberId: phoneB.id,
      enabled: true,
      messageTemplate: "BETA recovery opener",
    },
  });

  const contactA = await prisma.contact.create({
    data: { workspaceId: wsA.id, phone: TENANT_ISO_CONSUMER_E164, firstName: "AlphaConsumer" },
  });
  const contactB = await prisma.contact.create({
    data: { workspaceId: wsB.id, phone: TENANT_ISO_CONSUMER_E164, firstName: "BetaConsumer" },
  });

  const convA = await prisma.conversation.create({
    data: {
      workspaceId: wsA.id,
      contactId: contactA.id,
      productSource: "MCTB",
      phoneNumberId: phoneA.id,
      status: "OPEN",
    },
  });
  const convB = await prisma.conversation.create({
    data: {
      workspaceId: wsB.id,
      contactId: contactB.id,
      productSource: "MCTB",
      phoneNumberId: phoneB.id,
      status: "OPEN",
    },
  });

  await prisma.conversationMessage.create({
    data: {
      conversationId: convA.id,
      direction: "outbound",
      body: "ALPHA thread message",
    },
  });
  await prisma.conversationMessage.create({
    data: {
      conversationId: convB.id,
      direction: "outbound",
      body: "BETA thread message",
    },
  });

  const msgA = await prisma.message.create({
    data: {
      workspaceId: wsA.id,
      to: TENANT_ISO_CONSUMER_E164,
      from: phoneAE164,
      body: "ALPHA outbound SMS",
      status: "sent",
      providerId: `iso-msg-a-${token}`,
    },
  });

  const now = new Date();
  const missedA = await prisma.missedCallEvent.create({
    data: {
      workspaceId: wsA.id,
      callerE164: TENANT_ISO_CONSUMER_E164,
      businessE164: phoneAE164,
      phoneNumberId: phoneA.id,
      reason: "no_answer",
      eligible: true,
      status: "SENT",
      detectedAt: now,
      smsSentAt: now,
      traceId: `trace-a-${token}`,
      idempotencyKey: `iso-mce-a-${token}`,
    },
  });
  const missedB = await prisma.missedCallEvent.create({
    data: {
      workspaceId: wsB.id,
      callerE164: TENANT_ISO_CONSUMER_E164,
      businessE164: phoneBE164,
      phoneNumberId: phoneB.id,
      reason: "no_answer",
      eligible: true,
      status: "SENT",
      detectedAt: now,
      smsSentAt: now,
      traceId: `trace-b-${token}`,
      idempotencyKey: `iso-mce-b-${token}`,
    },
  });

  const agentA = await prisma.voiceAgent.create({
    data: {
      workspaceId: wsA.id,
      name: "ALPHA_AGENT",
      agentType: "generic",
      phoneNumberId: phoneA.id,
    },
  });
  const agentB = await prisma.voiceAgent.create({
    data: {
      workspaceId: wsB.id,
      name: "BETA_AGENT",
      agentType: "generic",
      phoneNumberId: phoneB.id,
    },
  });

  const voiceCallA = await prisma.voiceCall.create({
    data: {
      workspaceId: wsA.id,
      agentId: agentA.id,
      phoneNumberId: phoneA.id,
      direction: "INBOUND",
      status: "COMPLETED",
      fromE164: TENANT_ISO_CONSUMER_E164,
      toE164: phoneAE164,
      startedAt: now,
    },
  });

  const kbA = await prisma.voiceKnowledgeBase.create({
    data: {
      workspaceId: wsA.id,
      name: "ALPHA_KB",
      description: "ALPHA PLUMBING knowledge only",
    },
  });

  await prisma.voiceService.create({
    data: { workspaceId: wsA.id, name: "Drain Cleaning", durationMinutes: 60 },
  });
  await prisma.voiceService.create({
    data: { workspaceId: wsB.id, name: "Panel Replacement", durationMinutes: 120 },
  });

  return {
    slugA,
    slugB,
    workspaceAId: wsA.id,
    workspaceBId: wsB.id,
    phoneAId: phoneA.id,
    phoneBId: phoneB.id,
    phoneAE164,
    phoneBE164,
    contactAId: contactA.id,
    contactBId: contactB.id,
    conversationAId: convA.id,
    conversationBId: convB.id,
    messageAId: msgA.id,
    missedCallAId: missedA.id,
    missedCallBId: missedB.id,
    voiceAgentAId: agentA.id,
    voiceAgentBId: agentB.id,
    voiceCallAId: voiceCallA.id,
    knowledgeAId: kbA.id,
  };
}

export async function deleteTenantIsoFixture(fx: TenantIsoFixture): Promise<void> {
  const prisma = getPrisma();
  await prisma.workspace.delete({ where: { id: fx.workspaceAId } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: fx.workspaceBId } }).catch(() => undefined);
}

export function snapshotCallHandling(settingsJson: unknown) {
  return JSON.stringify(readCallHandlingBlock(settingsJson));
}
