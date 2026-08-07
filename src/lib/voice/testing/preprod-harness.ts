/**
 * Shared harness for Caller Amy pre-production integration tests.
 */
import { getPrisma } from "@/lib/db";
import { POST as toolWebhookPost } from "@/app/api/telnyx/voice/tools/route";
import { buildTelnyxToolWebhookRequest } from "./telnyx-fixtures";

export const EXPECTED_MODEL_WEBHOOK_TOOLS = ["runtime_turn"] as const;

export const FORBIDDEN_MODEL_TOOLS = [
  "calendar_availability",
  "book_appointment",
  "resolve_datetime",
  "hold_appointment_slot",
  "release_appointment_hold",
  "save_collected_fields",
  "get_workflow_requirements",
  "check_availability",
  "record_current_field",
  "continue_workflow",
  "get_runtime_context",
  "lookup_customer",
  "take_structured_message",
  "escalate_human",
  "transfer",
  "hangup",
] as const;

export type PreprodContext = {
  workspaceId: string;
  agentId: string;
  phoneNumberId: string;
  toE164: string;
  slug: string;
  callIds: string[];
  /** Canonical call used for CALL DATA five-gate checks (transcript path) */
  gateCallId?: string;
  /** Call used for TeXML timestamp/duration assertions */
  texmlGateCallId?: string;
  /** Call that completed the full booking commit path */
  bookingCallId?: string;
  appointmentIds: string[];
};

export async function createPreprodTenant(): Promise<PreprodContext> {
  const prisma = getPrisma();
  const slug = `amy-preprod-${Date.now()}`;
  const ws = await prisma.workspace.create({
    data: { name: "Amy Preprod", slug },
  });
  const toE164 = `+1415555${String(Date.now()).slice(-4)}`;
  const pn = await prisma.phoneNumber.create({
    data: {
      workspaceId: ws.id,
      e164: toE164,
      type: "Local",
      status: "Active",
    },
  });

  const problemFieldId = "problem_description";
  const draftConfig = {
    agentType: "appointment_booking",
    enabledBuiltinTools: [
      "lookup_customer",
      "take_structured_message",
      "record_current_field",
      "continue_workflow",
      "get_runtime_context",
      "escalate_human",
      "hangup",
      "transfer",
    ],
    conversationFlow: {
      sections: [
        {
          id: "booking",
          type: "booking",
          config: {
            collectFields: [
              {
                id: "name",
                label: "Name",
                type: "text",
                required: true,
                question: "What is your name?",
                enabled: true,
                askOrder: 1,
              },
              {
                id: "phone",
                label: "Phone",
                type: "phone",
                required: true,
                question: "What is the best phone number?",
                enabled: true,
                askOrder: 2,
              },
              {
                id: "email",
                label: "Email",
                type: "email",
                required: true,
                question: "What is your email address?",
                enabled: true,
                askOrder: 3,
              },
              {
                id: problemFieldId,
                label: "Problem description",
                type: "long_text",
                required: true,
                question: "Please describe the problem.",
                enabled: true,
                askOrder: 4,
              },
            ],
          },
        },
      ],
    },
  };

  const agent = await prisma.voiceAgent.create({
    data: {
      workspaceId: ws.id,
      name: "Amy Preprod",
      agentType: "appointment_booking",
      status: "TESTING",
      phoneNumberId: pn.id,
      draftConfig: draftConfig as object,
    },
  });

  await prisma.voiceService.create({
    data: {
      workspaceId: ws.id,
      name: "Appointment",
      durationMinutes: 30,
      bufferMinutes: 0,
      config: {
        enabled: true,
        bookingHours: "9-17",
        timezone: "America/New_York",
        minimumBookingNoticeMinutes: 0,
        maxDaysAhead: 30,
        bookingPermission: "anyone",
      },
    },
  });

  await prisma.workspaceMessagingSettings
    .upsert({
      where: { workspaceId: ws.id },
      create: { workspaceId: ws.id, timezone: "America/New_York" },
      update: { timezone: "America/New_York" },
    })
    .catch(() => undefined);

  return {
    workspaceId: ws.id,
    agentId: agent.id,
    phoneNumberId: pn.id,
    toE164,
    slug,
    callIds: [],
    appointmentIds: [],
  };
}

export async function cleanupPreprodTenant(ctx: PreprodContext): Promise<void> {
  const prisma = getPrisma();
  const ws = ctx.workspaceId;
  if (ctx.appointmentIds.length) {
    await prisma.voiceAppointment
      .deleteMany({ where: { id: { in: ctx.appointmentIds }, workspaceId: ws } })
      .catch(() => undefined);
  }
  for (const callId of ctx.callIds) {
    await prisma.voiceAppointment.deleteMany({ where: { callId, workspaceId: ws } }).catch(() => undefined);
    await prisma.voiceToolExecution.deleteMany({ where: { callId } }).catch(() => undefined);
    await prisma.voiceTranscriptSegment.deleteMany({ where: { workspaceId: ws } }).catch(() => undefined);
    await prisma.voiceTranscript.deleteMany({ where: { callId } }).catch(() => undefined);
    await prisma.voiceCallEvent.deleteMany({ where: { callId } }).catch(() => undefined);
    await prisma.voiceCall.delete({ where: { id: callId } }).catch(() => undefined);
  }
  await prisma.providerWebhookEvent.deleteMany({
    where: { workspaceId: ws, eventType: "voice.tool_webhook.ingress" },
  }).catch(() => undefined);
  await prisma.voiceAgent.deleteMany({ where: { workspaceId: ws } }).catch(() => undefined);
  await prisma.voiceService.deleteMany({ where: { workspaceId: ws } }).catch(() => undefined);
  await prisma.phoneNumber.delete({ where: { id: ctx.phoneNumberId } }).catch(() => undefined);
  await prisma.workspace.delete({ where: { id: ws } }).catch(() => undefined);
}

export function newTelnyxIds(prefix: string): {
  callControlId: string;
  conversationId: string;
} {
  const stamp = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 10000);
  return {
    callControlId: `v3:preprod_${prefix}_${stamp}_${rand}`,
    conversationId: `conv-preprod-${prefix}-${stamp}-${rand}`,
  };
}

/** Isolated test ANI — avoids colliding with production contacts on shared DBs. */
export function preprodCallerAni(suffix = ""): string {
  const n = String(Math.floor(Math.random() * 9000) + 1000);
  return `+1415555${n}${suffix ? suffix.slice(0, 2) : ""}`;
}

export async function invokeToolWebhook(input: {
  ctx: PreprodContext;
  toolType: string;
  body?: Record<string, unknown>;
  callControlId: string;
  conversationId: string;
  fromE164?: string;
  ensureCallFirst?: boolean;
}): Promise<{ status: number; json: Record<string, unknown>; callId?: string }> {
  const fromE164 = input.fromE164 ?? preprodCallerAni();

  if (input.ensureCallFirst !== false) {
    const { ensureVoiceCallForToolWebhook } = await import("@/lib/voice/ensure-call-from-event");
    const callId = await ensureVoiceCallForToolWebhook({
      workspaceId: input.ctx.workspaceId,
      agentId: input.ctx.agentId,
      callControlId: input.callControlId,
      conversationId: input.conversationId,
      fromE164,
      toE164: input.ctx.toE164,
    });
    if (callId && !input.ctx.callIds.includes(callId)) {
      input.ctx.callIds.push(callId);
    }
  }

  const request = buildTelnyxToolWebhookRequest({
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
    toolType: input.toolType,
    body: input.body,
    callControlId: input.callControlId,
    conversationId: input.conversationId,
    fromE164,
    toE164: input.ctx.toE164,
  });

  const response = await toolWebhookPost(request);
  const json = (await response.json()) as Record<string, unknown>;

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: {
      workspaceId: input.ctx.workspaceId,
      telnyxCallControlId: input.callControlId,
    },
    select: { id: true },
  });
  if (call?.id && !input.ctx.callIds.includes(call.id)) {
    input.ctx.callIds.push(call.id);
  }

  return { status: response.status, json, callId: call?.id };
}

export function telnyxToolNamesFromBuild(_agent: unknown, tools: Record<string, unknown>[]): string[] {
  return tools
    .map((t) => {
      const w = (t as { webhook?: { name?: string } }).webhook;
      const h = (t as { hangup?: unknown }).hangup;
      if (w?.name) return w.name;
      if (h) return "hangup";
      return null;
    })
    .filter(Boolean) as string[];
}
