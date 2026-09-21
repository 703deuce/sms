import "server-only";

import { getPrisma } from "@/lib/db";
import { isVoiceV3CallBillable } from "./is-voice-v3-call-billable";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

const PRODUCT = "voice_v3";
const METRIC = "billable_call";

export async function recordVoiceV3BillableCallIfEligible(callId: string): Promise<{
  recorded: boolean;
  usageEventId?: string;
}> {
  const prisma = getPrisma();
  const call = await prisma.voiceCall.findUnique({ where: { id: callId } });
  if (!call || !isVoiceV3CallBillable(call)) {
    return { recorded: false };
  }

  try {
    const event = await prisma.voiceV3UsageEvent.create({
      data: {
        workspaceId: call.workspaceId,
        voiceCallId: call.id,
        product: PRODUCT,
        metric: METRIC,
        quantity: 1,
        occurredAt: call.endedAt || new Date(),
        billingStatus: "pending",
      },
    });

    await enqueueJob({
      jobType: "voice_v3_billing_dispatch",
      workspaceId: call.workspaceId,
      payload: { usageEventId: event.id },
      idempotencyKey: `voice_v3_billing:${event.id}`,
    });

    return { recorded: true, usageEventId: event.id };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return { recorded: false };
    }
    throw err;
  }
}
