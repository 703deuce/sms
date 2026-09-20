import "server-only";

import { getPrisma } from "@/lib/db";

/** Customer-facing billable usage zeroed; provider cost retained on usage rows. */
export async function applyUnwantedSolicitorCustomerBilling(input: {
  workspaceId: string;
  callId: string;
}): Promise<void> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { id: true, metadata: true, outcome: true },
  });
  if (!call) return;

  const prevMeta =
    call.metadata && typeof call.metadata === "object" && !Array.isArray(call.metadata)
      ? (call.metadata as Record<string, unknown>)
      : {};

  await prisma.voiceCall.update({
    where: { id: call.id },
    data: {
      outcome: call.outcome || "unwanted_solicitation",
      costCents: 0,
      metadata: {
        ...prevMeta,
        voiceV3Screening: {
          ...(typeof prevMeta.voiceV3Screening === "object" && prevMeta.voiceV3Screening
            ? (prevMeta.voiceV3Screening as Record<string, unknown>)
            : {}),
          transovoOutcome: "UNWANTED_SOLICITATION",
          customerBillable: false,
          classifiedAt: new Date().toISOString(),
        },
      } as object,
    },
  });

  await prisma.voiceUsageRecord.updateMany({
    where: { workspaceId: input.workspaceId, callId: input.callId },
    data: {
      billedCostCents: 0,
      metadata: {
        customerBillable: false,
        creditReason: "unwanted_solicitation",
      } as object,
    },
  });
}
