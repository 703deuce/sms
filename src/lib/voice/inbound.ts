import { getPrisma } from "@/lib/db";
import { evaluateInboundRouting } from "./routing";
import { dialOutboundCall, isTelnyxVoiceConfigured } from "./telnyx/assistant-sync";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function handleInboundCallEvent(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string;
  payload?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const from = normalizeE164(input.fromE164);
  const to = input.toE164;

  let contact = await prisma.contact.findUnique({
    where: { workspaceId_phone: { workspaceId: input.workspaceId, phone: from } },
  });

  const routing = await evaluateInboundRouting({
    workspaceId: input.workspaceId,
    fromE164: from,
    toE164: to,
    contactId: contact?.id,
    isKnownContact: Boolean(contact),
  });

  const pn = await prisma.phoneNumber.findFirst({
    where: { workspaceId: input.workspaceId, e164: to },
  });

  const call = await prisma.voiceCall.create({
    data: {
      workspaceId: input.workspaceId,
      agentId: routing.agentId,
      contactId: contact?.id,
      direction: "INBOUND",
      status: "RINGING",
      fromE164: from,
      toE164: to,
      phoneNumberId: pn?.id,
      telnyxCallControlId: input.telnyxCallControlId,
      metadata: { routing, payload: input.payload } as object,
    },
  });

  if (routing.action === "ai_answer" && routing.agentId) {
    const agent = await prisma.voiceAgent.findUnique({ where: { id: routing.agentId } });
    if (agent && isTelnyxVoiceConfigured() && input.telnyxCallControlId) {
      // Telnyx AI assistant answers via connection — answer call
      const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/answer`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);
    }
  }

  await prisma.voiceCallEvent.create({
    data: {
      workspaceId: input.workspaceId,
      callId: call.id,
      eventType: "inbound.routed",
      payload: routing as object,
    },
  });

  return { callId: call.id, routing };
}
