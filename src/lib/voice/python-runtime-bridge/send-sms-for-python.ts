import { enqueueVoiceOutbox } from "@/lib/voice/outbox/voice-outbox";
import { getPrisma } from "@/lib/db";

export type SendSmsForPythonInput = {
  workspaceId: string;
  agentId?: string | null;
  callId?: string | null;
  to?: string | null;
  body: string;
  phoneNumberId?: string | null;
};

/**
 * Queue an SMS from the Python voice runtime through the canonical messaging pipeline.
 */
export async function sendSmsForPython(input: SendSmsForPythonInput) {
  const workspaceId = String(input.workspaceId || "").trim();
  const body = String(input.body || "").trim();
  if (!workspaceId) return { ok: false, error: "workspaceId required" };
  if (!body) return { ok: false, error: "body required" };

  const prisma = getPrisma();
  let to = String(input.to || "").trim();
  let fromNumberId = input.phoneNumberId ? String(input.phoneNumberId) : null;

  if (input.callId) {
    const call = await prisma.voiceCall.findFirst({
      where: { id: input.callId, workspaceId },
      select: { fromE164: true, phoneNumberId: true },
    });
    if (!to && call?.fromE164) to = call.fromE164;
    if (!fromNumberId && call?.phoneNumberId) fromNumberId = call.phoneNumberId;
  }

  if (!to) return { ok: false, error: "to required" };

  if (!fromNumberId && input.agentId) {
    const agent = await prisma.voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId },
      select: { phoneNumberId: true },
    });
    fromNumberId = agent?.phoneNumberId || null;
  }

  let fromE164: string | undefined;
  if (fromNumberId) {
    const fromRow = await prisma.phoneNumber.findFirst({
      where: { id: fromNumberId, workspaceId },
      select: { e164: true },
    });
    fromE164 = fromRow?.e164 || undefined;
  }

  const operationId = `py_${input.callId || "call"}_${Date.now()}`;

  await enqueueVoiceOutbox({
    workspaceId,
    callId: input.callId || undefined,
    jobType: "voice_send_sms",
    payload: {
      workspaceId,
      to,
      body,
      from: fromE164,
      operationId,
      source: "ai_after_hours",
    },
    idempotencyKey: `sms-${operationId}`,
  });

  return {
    ok: true,
    queued: true,
    speak: "I'll text that to you now.",
  };
}
