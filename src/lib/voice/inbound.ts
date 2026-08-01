import { getPrisma } from "@/lib/db";
import { evaluateInboundRouting } from "./routing";
import {
  isTelnyxVoiceConfigured,
  startAiAssistantOnCall,
  startCallRecording,
} from "./telnyx/assistant-sync";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { parseVoiceAgentConfig } from "./types";

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

  const contact = await prisma.contact.findUnique({
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
      const { telnyxRequest } = await import("@/lib/messaging/telnyx/client");
      await telnyxRequest(`/calls/${input.telnyxCallControlId}/actions/answer`, {
        method: "POST",
        body: {},
      }).catch(() => undefined);

      // Critical: answering alone does not speak — attach the published assistant.
      if (agent.telnyxAssistantId) {
        const config = parseVoiceAgentConfig(agent.draftConfig);
        const contactName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ");
        const personalized = contactName
          ? `Hi ${contactName}, thanks for calling.`
          : undefined;
        await startAiAssistantOnCall({
          callControlId: input.telnyxCallControlId,
          assistantId: agent.telnyxAssistantId,
          greeting: personalized,
          clientState: {
            workspaceId: input.workspaceId,
            callId: call.id,
            agentId: agent.id,
          },
        }).catch((err) => console.error("[voice/inbound] ai_assistant_start", err));

        await startCallRecording(input.telnyxCallControlId);

        await prisma.voiceCall.update({
          where: { id: call.id },
          data: {
            status: "IN_PROGRESS",
            answeredAt: new Date(),
            metadata: {
              routing,
              payload: input.payload,
              aiStarted: true,
              assistantId: agent.telnyxAssistantId,
            } as object,
          },
        });
      }
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
