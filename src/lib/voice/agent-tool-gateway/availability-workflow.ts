import { getPrisma } from "@/lib/db";
import { buildCalendlyListAvailableTimesParams } from "@/lib/voice/calendar/booking-args";
import type { AgentToolContext, CanonicalAvailabilityInput } from "./types";
import { translateError } from "./errors";
import { toolSuccess } from "./envelope";
import {
  availabilityInputToLegacyArgs,
  validateAvailabilityInput,
} from "./normalize";

async function attachWorkflowRequirements(
  ctx: AgentToolContext,
  serviceName: string,
  result: ReturnType<typeof toolSuccess>,
) {
  if (!ctx.callId) return result;
  const { getWorkflowRequirements, requirementsToToolResponse } = await import(
    "@/lib/voice/field-runtime/requirements"
  );
  const req = await getWorkflowRequirements({
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    callId: ctx.callId,
    workflow: "book_appointment",
    serviceName,
  });
  return toolSuccess({
    status: result.status,
    user_message: result.user_message || "",
    data: {
      ...result.data,
      workflow_requirements: requirementsToToolResponse(req),
    },
  });
}

async function persistAvailabilitySlotsOnCall(input: {
  workspaceId: string;
  callId?: string;
  serviceName: string;
  slots: string[];
  window: { startTime: string; endTime: string };
}) {
  if (!input.callId) return;
  const prisma = getPrisma();
  const existing = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: { metadata: true },
  });
  const prevMeta = (existing?.metadata || {}) as Record<string, unknown>;
  await prisma.voiceCall
    .update({
      where: { id: input.callId },
      data: {
        metadata: {
          ...prevMeta,
          lastAvailabilitySlots: input.slots.filter(Boolean),
          lastAvailabilityAt: new Date().toISOString(),
          lastAvailabilityService: input.serviceName,
          lastAvailabilityWindow: input.window,
        } as object,
      },
    })
    .catch(() => undefined);
}

export async function runCheckAvailability(
  ctx: AgentToolContext,
  raw: Record<string, unknown>,
  normalized: CanonicalAvailabilityInput,
) {
  validateAvailabilityInput(normalized);
  const legacyArgs = availabilityInputToLegacyArgs(normalized);
  const calParams = buildCalendlyListAvailableTimesParams(legacyArgs, { maxDays: 3 });
  const window = calParams.window;

  const { getConnectedCalendly, requireCalendlyIntegrationOk } = await import(
    "@/lib/voice/calendar/calendly-voice"
  );
  const calendlyConn = await getConnectedCalendly(ctx.workspaceId);

  if (calendlyConn) {
    const serviceName = normalized.service_name;
    const {
      assertBookingPermission,
      loadServiceBookingConfig,
      filterSlotsByNoticeAndMaxDays,
    } = await import("@/lib/voice/calendar/booking");
    const gates = await loadServiceBookingConfig(ctx.workspaceId, serviceName);
    assertBookingPermission(gates.config);

    const { executeLiveAgentCalendlyAction } = await import(
      "@/lib/voice/tools/builtin-actions-calendly"
    );
    const result = await executeLiveAgentCalendlyAction({
      workspaceId: ctx.workspaceId,
      agentId: ctx.agentId,
      callId: ctx.callId,
      actionId: "appointment.list_available_times",
      params: {
        eventTypeUri: calParams.eventTypeUri,
        startTime: calParams.startTime,
        endTime: calParams.endTime,
      },
    });
    const okResult = requireCalendlyIntegrationOk(result, "list available times");
    const calendlyData = okResult.data || {};
    const rawSlots =
      (calendlyData as { slots?: Array<{ startsAt?: string; startTime?: string }> })
        .slots || (Array.isArray(calendlyData) ? calendlyData : []);
    const normalizedSlots = (
      rawSlots as Array<{ startsAt?: string; startTime?: string }>
    ).map((s) => ({
      startsAt: String(s.startsAt || s.startTime || ""),
    }));
    const slots = filterSlotsByNoticeAndMaxDays(
      normalizedSlots.filter((s) => s.startsAt),
      gates.noticeMinutes,
      gates.maxDaysAhead,
      new Date(),
      {
        sameDayCutoff: gates.config.sameDayCutoff,
        timezone: String(
          normalized.timezone || gates.config.timezone || "America/New_York",
        ),
      },
    );
    const offered = slots.slice(0, 5);
    const slotTimes = offered.map((s) => s.startsAt);
    await persistAvailabilitySlotsOnCall({
      workspaceId: ctx.workspaceId,
      callId: ctx.callId,
      serviceName,
      slots: slotTimes,
      window: { startTime: window.startTime, endTime: window.endTime },
    });

    const userMessage = offered.length
      ? `Found ${offered.length} available slot(s). Offer these start_time values exactly: ${slotTimes.join(", ")}`
      : "No openings in that window. Widen the day or ask for another day — never invent times.";

    return attachWorkflowRequirements(ctx, serviceName, toolSuccess({
      status: offered.length ? "available" : "unavailable",
      user_message: userMessage,
      data: {
        provider: "calendly",
        slots: offered.map((s) => ({
          start_time: s.startsAt,
          startsAt: s.startsAt,
        })),
        window: { start_time: window.startTime, end_time: window.endTime },
      },
    }));
  }

  const { getAvailability } = await import("@/lib/voice/calendar/booking");
  const availability = await getAvailability(ctx.workspaceId, {
    ...legacyArgs,
    daysAhead: window.daysAhead,
    startTime: window.startTime,
    endTime: window.endTime,
    preferredStartMinute: window.preferredStartMinute,
    preferredEndMinute: window.preferredEndMinute,
    maxSlots: 5,
  });
  const offered = (availability.slots || []).slice(0, 5);
  const slotTimes = offered.map((s) => String(s.startsAt || ""));
  await persistAvailabilitySlotsOnCall({
    workspaceId: ctx.workspaceId,
    callId: ctx.callId,
    serviceName: normalized.service_name,
    slots: slotTimes,
    window: { startTime: window.startTime, endTime: window.endTime },
  });

  return attachWorkflowRequirements(ctx, normalized.service_name, toolSuccess({
    status: offered.length ? "available" : "unavailable",
    user_message: offered.length
      ? `Found ${offered.length} available slot(s): ${slotTimes.join(", ")}`
      : "No openings in that window.",
    data: {
      provider: "internal",
      slots: offered.map((s) => ({
        start_time: s.startsAt,
        startsAt: s.startsAt,
      })),
      window: { start_time: window.startTime, end_time: window.endTime },
    },
  }));
}

export async function runCheckAvailabilityTool(
  ctx: AgentToolContext,
  raw: Record<string, unknown>,
) {
  try {
    const { normalizeAvailabilityInput } = await import("./normalize");
    const normalized = normalizeAvailabilityInput(raw);
    return await runCheckAvailability(ctx, raw, normalized);
  } catch (err) {
    throw translateError(err);
  }
}
