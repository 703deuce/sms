import { getPrisma } from "@/lib/db";

const TELEPHONY_CENTS_PER_MIN = Number(process.env.VOICE_TELEPHONY_CENTS_PER_MIN || 2);
const AI_CENTS_PER_MIN = Number(process.env.VOICE_AI_CENTS_PER_MIN || 8);

export async function recordVoiceUsage(input: {
  workspaceId: string;
  callId?: string;
  agentId?: string | null;
  campaignId?: string | null;
  telephonyMinutes: number;
  aiMinutes: number;
  isTest?: boolean;
}) {
  const prisma = getPrisma();
  const providerTelephony = Math.round(input.telephonyMinutes * TELEPHONY_CENTS_PER_MIN);
  const providerAi = Math.round(input.aiMinutes * AI_CENTS_PER_MIN);
  const markup = Number(process.env.VOICE_BILLING_MARKUP || 1.5);
  const billedTelephony = Math.round(providerTelephony * markup);
  const billedAi = Math.round(providerAi * markup);

  if (input.callId) {
    await prisma.voiceCall.update({
      where: { id: input.callId },
      data: {
        aiMinutes: input.aiMinutes,
        providerCostCents: providerTelephony + providerAi,
        costCents: billedTelephony + billedAi,
      },
    });
  }

  await prisma.voiceUsageRecord.createMany({
    data: [
      {
        workspaceId: input.workspaceId,
        callId: input.callId,
        agentId: input.agentId,
        campaignId: input.campaignId,
        category: "telephony",
        quantity: input.telephonyMinutes,
        unit: "minute",
        providerCostCents: providerTelephony,
        billedCostCents: billedTelephony,
        metadata: { isTest: input.isTest },
      },
      {
        workspaceId: input.workspaceId,
        callId: input.callId,
        agentId: input.agentId,
        campaignId: input.campaignId,
        category: "ai_minutes",
        quantity: input.aiMinutes,
        unit: "minute",
        providerCostCents: providerAi,
        billedCostCents: billedAi,
        metadata: { isTest: input.isTest },
      },
    ],
  });

  // Aggregate into UsageRecord for current month
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const existing = await prisma.usageRecord.findFirst({
    where: {
      workspaceId: input.workspaceId,
      periodStart,
    },
  });

  if (existing) {
    await prisma.usageRecord.update({
      where: { id: existing.id },
      data: {
        voiceMinutes: (existing.voiceMinutes || 0) + input.telephonyMinutes,
        aiMinutes: (existing.aiMinutes || 0) + input.aiMinutes,
        voiceCostCents: (existing.voiceCostCents || 0) + billedTelephony + billedAi,
        costCents: (existing.costCents || 0) + billedTelephony + billedAi,
      },
    });
  } else {
    await prisma.usageRecord.create({
      data: {
        workspaceId: input.workspaceId,
        periodStart,
        periodEnd,
        voiceMinutes: input.telephonyMinutes,
        aiMinutes: input.aiMinutes,
        voiceCostCents: billedTelephony + billedAi,
        costCents: billedTelephony + billedAi,
      },
    });
  }

  return { providerTelephony, providerAi, billedTelephony, billedAi };
}
