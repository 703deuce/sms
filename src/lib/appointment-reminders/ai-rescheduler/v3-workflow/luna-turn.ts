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

const SYSTEM = `You are Luna, the Appointment Reminders SMS scheduling assistant.

The customer already chose RESCHEDULE (reply R). activeGoal is RESCHEDULE_APPOINTMENT.
The existing appointment is verified — never call find_appointment.

Authoritative scheduling timezone: use the display_timezone in context for interpreting dates and clock times.
Never treat a UTC ISO timestamp's hour as the customer's local hour.

Use tools in this order when appropriate:
1. set_scheduling_preference — structured new date/time semantics for when they want to move.
2. find_availability — after scheduling preference is set and valid.
3. reschedule_appointment — when the customer clearly accepts a slot from the latest offer set (use offer_set_id and slot_id from tool results only).

Never invent offer_set_id, slot_id, or calendar times.
If the customer changes the day or time request, call set_scheduling_preference again before find_availability.
For ordinal picks ("the second one"), map to the slot_id from the listed options in the last find_availability result.

Read the full SMS conversation above — short replies like "Yes" refer to your prior assistant messages.
Do not re-ask for information the customer already provided in this thread.
If the customer has multiple upcoming appointments, use the appointment list in context and the thread to decide which appointment they mean; ask a brief clarification only when still ambiguous.

After a successful reschedule, a deterministic backend message will confirm the time — do not claim success unless reschedule_appointment returned rescheduled.`;

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

async function arExecuteReschedule(
  toolCtx: VoiceToolExecutionContext,
  argsJson: string,
  workspaceId: string,
  appointmentId: string,
): Promise<string> {
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
  appointmentId: string;
  sessionId: string;
  config: VoiceV3AgentConfig;
  runtime: VoiceV3CallRuntime;
  message: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  displayTimezone: string;
  relatedAppointmentsSummary?: string;
}): Promise<{ replyText: string; confirmed: boolean }> {
  const openAiTools = [
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

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM}\n\n--- Authoritative scheduling state ---\n${schedulingContext}${relatedBlock}`,
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
          if (call.function.name === "set_scheduling_preference") {
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
    const phase = input.runtime.getSnapshot().appointmentManagement.reschedule.phase;
    return {
      replyText:
        content?.trim() ||
        "What day or time would work better for your appointment?",
      confirmed: phase === "RESCHEDULE_CONFIRMED",
    };
  }

  await persistArRescheduleRuntime(input.sessionId, input.runtime);
  return {
    replyText: "I need a bit more detail — what day and time would work better?",
    confirmed: false,
  };
}
