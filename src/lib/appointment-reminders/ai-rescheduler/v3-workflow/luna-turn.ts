import "server-only";

import { arAiReschedulerModelOptions } from "../model";
import type { VoiceV3AgentConfig } from "@/lib/voice-v3/config/agent-config";
import { VoiceV3CallRuntime } from "@/lib/voice-v3/state/call-runtime";
import { buildSetSchedulingPreferenceOpenAiTool } from "@/lib/voice-v3/tools/set-scheduling-preference-tool";
import { buildFindAvailabilityOpenAiTool } from "@/lib/voice-v3/tools/find-availability-tool";
import { buildRescheduleAppointmentOpenAiTool } from "@/lib/voice-v3/tools/reschedule-appointment-tool";
import { setSchedulingPreferenceTool } from "@/lib/voice-v3/tools/set-scheduling-preference-tool";
import { rescheduleAppointmentTool } from "@/lib/voice-v3/tools/reschedule-appointment-tool";
import type { VoiceToolExecutionContext } from "@/lib/voice-v3/tools/types";
import { dispatchFindAvailabilityIfRequired } from "@/lib/voice-v3/calendar/find-dispatch";
import { dispatchRescheduleIfRequired } from "@/lib/voice-v3/calendar/reschedule-dispatch";
import { patchProviderEventTimes } from "../provider-mutations";
import { syncLocalAppointmentAfterProviderReschedule } from "../commit-reschedule";
import { buildArFindBusyFetcher } from "./fetch-busy";
import { persistArRescheduleRuntime } from "./session-runtime";
import { createId } from "@/lib/supabase/id";
import { openAiChatWithTools, type ChatMessage } from "./openai-tools";
import { buildArRescheduleConfirmedSms } from "../display-time";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveAiReschedulerConfig } from "../types";
import { resolveArRescheduleSmsPolicy } from "../ar-sms-action-policy";
import {
  consumePolicyAck,
  gateArSmsCalendarWriteByPolicy,
  getArSmsPolicyAck,
  mergePolicyAckIntoMetadata,
} from "../ar-sms-policy-ack";
import { getPrisma } from "@/lib/db";
import { markArReplySessionLifecycle } from "@/lib/appointment-reminders/messaging/reply-session";
import { AR_SMS_APPOINTMENT_AGENT_SYSTEM_PROMPT } from "../context-agent/ar-sms-appointment-agent-prompt";
import type { ArSmsContextInterpretation } from "../context-agent/ar-sms-context-schema";
import { handleArReminderLetterReply } from "../inbound-replies";

const AR_LETTER_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "confirm_appointment_attendance",
      description:
        "Customer confirms they will attend. Backend enforces policy. Use when they mean confirm/C.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_appointment_cancellation",
      description:
        "Customer wants to cancel. Starts SMS cancellation flow with policy checks. Use when they mean cancel/X or cannot attend and want to cancel.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "begin_reschedule_request",
      description:
        "Customer wants to change appointment time. Opens reschedule when policy allows. Use when they mean reschedule/R or want a new time.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
    },
  },
];

function formatOfferSummary(runtime: VoiceV3CallRuntime): string {
  const snap = runtime.getSnapshot();
  const offer = snap.availability.activeOfferSet;
  if (!offer?.slots.length) return "No active offer set.";
  const lines = offer.slots.map(
    (s, i) => `${i + 1}. slot_id=${s.slotId} local_start=${s.localStart}`,
  );
  return `Active offer_set_id=${offer.offerSetId} scheduling_generation=${offer.schedulingGeneration}\n${lines.join("\n")}`;
}

function buildToolCtx(
  runtime: VoiceV3CallRuntime,
  workspaceId: string,
): VoiceToolExecutionContext {
  return {
    callId: runtime.getSnapshot().callId,
    liveSessionId: runtime.getSnapshot().liveSessionId,
    delegationId: null,
    functionCallId: `ar_${createId()}`,
    runtime,
    tenantId: workspaceId,
    sendContext: () => undefined,
    delegationSemanticallyFresh: true,
  };
}

async function arExecuteFindAvailability(
  toolCtx: VoiceToolExecutionContext,
  workspaceId: string,
  appointmentId: string,
): Promise<string> {
  const snap = toolCtx.runtime.getSnapshot();
  if (!snap.scheduling.normalized) {
    return JSON.stringify({
      ok: false,
      status: "SCHEDULING_PREFERENCE_REQUIRED",
      message: "Call set_scheduling_preference first.",
    });
  }

  await dispatchFindAvailabilityIfRequired(toolCtx.runtime, {
    awaitCompletion: true,
    fetchBusy: buildArFindBusyFetcher({ workspaceId, appointmentId }),
  });

  const after = toolCtx.runtime.getSnapshot();
  const offer = after.availability.activeOfferSet;
  if (after.availability.status === "failed") {
    return JSON.stringify({
      ok: false,
      status: "FIND_FAILED",
      failure: after.availability.lastFailure,
    });
  }
  if (!offer || offer.slots.length === 0) {
    return JSON.stringify({
      ok: true,
      status: "none_available",
      scheduling_generation: after.scheduling.generation,
    });
  }
  return JSON.stringify({
    ok: true,
    status: "available",
    offer_set_id: offer.offerSetId,
    scheduling_generation: offer.schedulingGeneration,
    slots: offer.slots.map((s) => ({
      slot_id: s.slotId,
      local_start: s.localStart,
      local_end: s.localEnd,
    })),
  });
}

function resetReschedulePhaseForNewRequest(runtime: VoiceV3CallRuntime): void {
  const snap = runtime.getSnapshot();
  if (snap.appointmentManagement.reschedule.phase !== "RESCHEDULE_CONFIRMED") return;
  runtime.replaceContext({
    ...snap,
    appointmentManagement: {
      ...snap.appointmentManagement,
      reschedule: { phase: "NONE", attemptId: null },
    },
  });
}

async function arExecuteReschedule(
  toolCtx: VoiceToolExecutionContext,
  argsJson: string,
  workspaceId: string,
  appointmentId: string,
): Promise<string> {
  const prisma = getPrisma();
  const appt = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
    select: { startsAt: true, metadata: true },
  });
  if (!appt) {
    return JSON.stringify({ ok: false, error: "appointment_not_found" });
  }
  const platform = await loadAppointmentPlatformConfig(workspaceId);
  const ar = resolveAiReschedulerConfig(platform);
  const reschedulePolicy = resolveArRescheduleSmsPolicy(ar);
  const policyGate = gateArSmsCalendarWriteByPolicy({
    meta: (appt.metadata || {}) as import("@/lib/appointments/types").AppointmentMetadata,
    action: "reschedule",
    startsAt: appt.startsAt,
    policy: reschedulePolicy,
  });
  if (!policyGate.allowed) {
    return JSON.stringify({
      ok: false,
      status: policyGate.code,
      message: policyGate.customerMessage,
    });
  }

  const args = JSON.parse(argsJson) as unknown;
  const validated = rescheduleAppointmentTool.validate(args);
  const bindResult = await rescheduleAppointmentTool.execute(toolCtx, validated);
  if (!bindResult.ok) {
    return JSON.stringify(bindResult);
  }

  await dispatchRescheduleIfRequired(toolCtx.runtime, {
    awaitCompletion: true,
    fetchRevalidateBusy: async (input) => {
      const fetcher = buildArFindBusyFetcher({ workspaceId, appointmentId });
      const r = await fetcher({
        request: {
          callId: toolCtx.callId,
          schedulingGeneration: toolCtx.runtime.getSnapshot().scheduling.generation,
          timezone: toolCtx.runtime.config.timezone,
          rangeStartUtc: input.rangeStartUtc,
          rangeEndUtc: input.rangeEndUtc,
          durationMinutes: toolCtx.runtime.config.service.durationMinutes,
          calendarIds: input.calendarIds,
          requestKey: `revalidate|${input.rangeStartUtc}`,
        },
        config: toolCtx.runtime.config,
      });
      if (!r.ok) throw new Error(r.failure.message);
      return { ok: true as const, busy: r.busy };
    },
    updateBooking: async (u) => {
      const patched = await patchProviderEventTimes({
        workspaceId,
        appointmentId,
        startsAt: new Date(u.startUtc),
        endsAt: new Date(u.endUtc),
        summary: u.summary,
      });
      if (!patched.ok) {
        return { ok: false, message: patched.message, outcomeUncertain: patched.outcomeUncertain };
      }
      return { ok: true, durationMs: 0 };
    },
  });

  const after = toolCtx.runtime.getSnapshot();
  if (after.appointmentManagement.reschedule.phase === "RESCHEDULE_CONFIRMED") {
    const sel = after.selection.selected;
    const opId = after.appointmentManagement.reschedule.attemptId || `ar_v3_${createId()}`;
    if (sel) {
      await syncLocalAppointmentAfterProviderReschedule({
        workspaceId,
        appointmentId,
        startsAt: sel.startUtc,
        endsAt: sel.endUtc,
        operationId: opId,
        initiatedBy: "customer",
      });
      if (policyGate.ack) {
        const fresh = await prisma.voiceAppointment.findFirst({
          where: { id: appointmentId, workspaceId },
          select: { metadata: true },
        });
        const ack = getArSmsPolicyAck(
          (fresh?.metadata || {}) as import("@/lib/appointments/types").AppointmentMetadata,
        );
        if (ack) {
          await prisma.voiceAppointment.update({
            where: { id: appointmentId },
            data: {
              metadata: mergePolicyAckIntoMetadata(
                (fresh?.metadata || {}) as import("@/lib/appointments/types").AppointmentMetadata,
                consumePolicyAck(ack, "reschedule"),
              ) as object,
            },
          });
        }
      }
    }
  }

  const phase = toolCtx.runtime.getSnapshot().appointmentManagement.reschedule.phase;
  return JSON.stringify({ ...bindResult, reschedule_phase: phase });
}

function buildSchedulingContextBlock(input: {
  runtime: VoiceV3CallRuntime;
  displayTimezone: string;
  appointmentId: string;
}): string {
  const snap = input.runtime.getSnapshot();
  return [
    `appointment_id=${input.appointmentId}`,
    `display_timezone=${input.displayTimezone}`,
    `Reschedule phase: ${snap.appointmentManagement.reschedule.phase}`,
    formatOfferSummary(input.runtime),
  ].join("\n");
}

export async function runArRescheduleLunaTurn(input: {
  workspaceId: string;
  contactId: string;
  appointmentId: string;
  sessionId: string;
  replySessionId: string;
  conversationId?: string;
  config: VoiceV3AgentConfig;
  runtime: VoiceV3CallRuntime;
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  displayTimezone: string;
  relatedAppointmentsSummary?: string;
  verifiedContextBlock?: string;
  sessionLifecycleState?: string;
  contextInterpretation?: ArSmsContextInterpretation;
}): Promise<{ replyText: string; confirmed: boolean }> {
  const openAiTools = [
    ...AR_LETTER_TOOLS,
    buildSetSchedulingPreferenceOpenAiTool(input.config),
    buildFindAvailabilityOpenAiTool(input.config),
    buildRescheduleAppointmentOpenAiTool(input.config),
  ].map((t) => ({
    type: "function" as const,
    function: {
      name: t.name!,
      description: t.description,
      parameters: (t.parameters || {}) as Record<string, unknown>,
    },
  }));

  const schedulingContext = buildSchedulingContextBlock({
    runtime: input.runtime,
    displayTimezone: input.displayTimezone,
    appointmentId: input.appointmentId,
  });

  const relatedBlock = input.relatedAppointmentsSummary?.trim()
    ? `\n\n--- Related appointments ---\n${input.relatedAppointmentsSummary.trim()}`
    : "";
  const verifiedBlock = input.verifiedContextBlock?.trim()
    ? `\n\n--- Verified appointment & policy context ---\n${input.verifiedContextBlock.trim()}`
    : "";
  const interpretationBlock = input.contextInterpretation
    ? `\n\n--- Context Agent interpretation (advisory only; verify against conversation) ---\n${JSON.stringify(input.contextInterpretation)}`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${AR_SMS_APPOINTMENT_AGENT_SYSTEM_PROMPT}\n\n--- Authoritative scheduling state ---\n${schedulingContext}${verifiedBlock}${interpretationBlock}${relatedBlock}`,
    },
  ];

  for (const turn of input.conversationHistory) {
    if (!turn.content.trim()) continue;
    messages.push({ role: turn.role, content: turn.content });
  }

  const last = messages[messages.length - 1];
  const current = (input.message || "").trim();
  if (current && !(last?.role === "user" && last.content === current)) {
    messages.push({ role: "user", content: current });
  }

  const toolCtx = buildToolCtx(input.runtime, input.workspaceId);
  const modelOpts = arAiReschedulerModelOptions();

  for (let round = 0; round < 8; round += 1) {
    const response = await openAiChatWithTools({
      messages,
      tools: openAiTools,
      model: modelOpts.model,
      temperature: 0.2,
      maxTokens: 900,
    });

    if (!response) {
      return {
        replyText:
          "Our scheduling assistant is temporarily unavailable. Please try again in a few minutes.",
        confirmed: false,
      };
    }

    const { content, tool_calls } = response.message;
    if (tool_calls?.length) {
      messages.push({
        role: "assistant",
        content: content || "",
        tool_calls,
      });
      for (const call of tool_calls) {
        let result: string;
        try {
          if (call.function.name === "confirm_appointment_attendance") {
            const r = await handleArReminderLetterReply({
              workspaceId: input.workspaceId,
              contactId: input.contactId,
              conversationId: input.conversationId,
              explicitAppointmentId: input.appointmentId,
              replySessionId: input.replySessionId,
              body: input.message,
              letter: "C",
            });
            result = JSON.stringify({
              ok: r.handled,
              action: "confirm",
              backend_message: r.handled ? r.replyText : null,
            });
          } else if (call.function.name === "request_appointment_cancellation") {
            const r = await handleArReminderLetterReply({
              workspaceId: input.workspaceId,
              contactId: input.contactId,
              conversationId: input.conversationId,
              explicitAppointmentId: input.appointmentId,
              replySessionId: input.replySessionId,
              body: input.message,
              letter: "X",
            });
            result = JSON.stringify({
              ok: r.handled,
              action: "cancel",
              backend_message: r.handled ? r.replyText : null,
            });
          } else if (call.function.name === "begin_reschedule_request") {
            const r = await handleArReminderLetterReply({
              workspaceId: input.workspaceId,
              contactId: input.contactId,
              conversationId: input.conversationId,
              explicitAppointmentId: input.appointmentId,
              replySessionId: input.replySessionId,
              body: input.message,
              letter: "R",
            });
            if (r.handled && r.openedRescheduleFlow) {
              await markArReplySessionLifecycle({
                sessionId: input.replySessionId,
                workspaceId: input.workspaceId,
                lifecycleState: "RESCHEDULING",
              });
            }
            result = JSON.stringify({
              ok: r.handled,
              action: "reschedule",
              backend_message: r.handled ? r.replyText : null,
            });
          } else if (call.function.name === "set_scheduling_preference") {
            resetReschedulePhaseForNewRequest(toolCtx.runtime);
            await markArReplySessionLifecycle({
              sessionId: input.replySessionId,
              workspaceId: input.workspaceId,
              lifecycleState: "RESCHEDULING",
            });
            const validated = setSchedulingPreferenceTool.validate(JSON.parse(call.function.arguments));
            const r = await setSchedulingPreferenceTool.execute(toolCtx, validated);
            result = JSON.stringify(r);
          } else if (call.function.name === "find_availability") {
            result = await arExecuteFindAvailability(toolCtx, input.workspaceId, input.appointmentId);
          } else if (call.function.name === "reschedule_appointment") {
            result = await arExecuteReschedule(
              toolCtx,
              call.function.arguments,
              input.workspaceId,
              input.appointmentId,
            );
          } else {
            result = JSON.stringify({ ok: false, error: "unknown_tool" });
          }
        } catch (err) {
          result = JSON.stringify({
            ok: false,
            error: err instanceof Error ? err.message : "tool_failed",
          });
        }
        messages.push({ role: "tool", tool_call_id: call.id, content: result });
      }
      await persistArRescheduleRuntime(input.sessionId, input.runtime);
      if (
        input.runtime.getSnapshot().appointmentManagement.reschedule.phase === "RESCHEDULE_CONFIRMED"
      ) {
        await persistArRescheduleRuntime(input.sessionId, input.runtime);
        const sel = input.runtime.getSnapshot().selection.selected;
        const startUtc = sel?.startUtc;
        const replyText =
          startUtc
            ? buildArRescheduleConfirmedSms(startUtc, input.displayTimezone)
            : "Your appointment has been rescheduled.";
        return {
          replyText,
          confirmed: true,
        };
      }
      continue;
    }

    await persistArRescheduleRuntime(input.sessionId, input.runtime);
    return {
      replyText:
        content?.trim() ||
        "What day or time would work better for your appointment?",
      confirmed: false,
    };
  }

  await persistArRescheduleRuntime(input.sessionId, input.runtime);
  return {
    replyText: "I need a bit more detail — what day and time would work better?",
    confirmed: false,
  };
}
