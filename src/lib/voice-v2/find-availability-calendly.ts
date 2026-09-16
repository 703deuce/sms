import "server-only";

import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { buildAdapterContext } from "@/lib/integrations/framework/context";
import { listEventTypeAvailableTimes } from "@/lib/integrations/adapters/calendly-actions";
import { wallTimeInZoneToUtc } from "@/lib/voice/calendar/timezone-slots";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { mapCalendlyAvailabilityToVoiceV2Slots } from "./calendly-slot-map";
import { resolveVoiceV2CalendlyBookingConfig } from "./calendly-booking-config";
import { persistVoiceV2OfferSet } from "./offer-set-store";
import { validateVoiceV2FindAvailabilityInput } from "./validate-input";
import type { VoiceV2FindAvailabilityResult, VoiceV2TimingMarks, VoiceV2TimingMs } from "./types";

function isoMark(): string {
  return new Date().toISOString();
}

function emptyTimingMs(): VoiceV2TimingMs {
  return {
    VALIDATION_MS: 0,
    WORKSPACE_RESOLUTION_MS: 0,
    CONNECTION_RESOLUTION_MS: 0,
    TOKEN_MS: 0,
    GRAPH_MS: 0,
    AVAILABILITY_COMPUTE_MS: 0,
    TOTAL_MS: 0,
  };
}

function parseYmd(date: string): { year: number; month: number; day: number } {
  const [y, m, d] = date.split("-").map((x) => Number(x));
  return { year: y, month: m, day: d };
}

function parseHm(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map((x) => Number(x));
  return { hour: h, minute: m };
}

async function loadCalendlyConfigForCall(
  workspaceId: string,
  agentId: string,
): Promise<ReturnType<typeof resolveVoiceV2CalendlyBookingConfig>> {
  const runtime = await loadVoiceAgentRuntimeConfig(workspaceId, agentId);
  const config = parseVoiceAgentConfig(runtime);
  return resolveVoiceV2CalendlyBookingConfig(config);
}

export async function executeVoiceV2FindAvailabilityCalendly(
  raw: Record<string, unknown>,
  resolvedWorkspaceId: string,
  options?: { voiceCallId?: string | null },
): Promise<VoiceV2FindAvailabilityResult> {
  const t0 = Date.now();
  const marks: VoiceV2TimingMarks = { REQUEST_RECEIVED: isoMark() };
  const timingMs = emptyTimingMs();

  try {
    const vStart = Date.now();
    const input = validateVoiceV2FindAvailabilityInput(raw, resolvedWorkspaceId);
    marks.INPUT_VALIDATED = isoMark();
    timingMs.VALIDATION_MS = Date.now() - vStart;

    const agentId = String(raw.agent_id || raw.agentId || "").trim();
    if (!agentId) {
      throw new Error("calendly_booking_requires_agent_id");
    }

    const wsStart = Date.now();
    const bookingCfg = await loadMctbAiBookingConfig(input.workspaceId);
    const calCfg = await loadCalendlyConfigForCall(input.workspaceId, agentId);
    if (!calCfg?.eventTypeUri) {
      throw new Error("calendly_event_type_not_configured");
    }
    const timezone = calCfg.timezone || bookingCfg.timezone?.trim() || "America/New_York";
    const serviceName = input.serviceName || bookingCfg.serviceName || calCfg.eventTypeName;
    marks.WORKSPACE_RESOLVED = isoMark();
    timingMs.WORKSPACE_RESOLUTION_MS = Date.now() - wsStart;

    const connStart = Date.now();
    const ctx = await buildAdapterContext(input.workspaceId, "calendly");
    marks.MICROSOFT_CONNECTION_RESOLVED = isoMark();
    timingMs.CONNECTION_RESOLUTION_MS = Date.now() - connStart;

    const { year, month, day } = parseYmd(input.requestedDate);
    const winStart = parseHm(input.timeWindow.start);
    const winEnd = parseHm(input.timeWindow.end);
    const windowStartUtc = wallTimeInZoneToUtc(
      timezone,
      year,
      month,
      day,
      winStart.hour,
      winStart.minute,
    );
    const windowEndUtc = wallTimeInZoneToUtc(
      timezone,
      year,
      month,
      day,
      winEnd.hour,
      winEnd.minute,
    );

    marks.GRAPH_STARTED = isoMark();
    const graphStart = Date.now();
    const avail = await listEventTypeAvailableTimes(ctx, {
      eventTypeUri: calCfg.eventTypeUri,
      startTime: windowStartUtc.toISOString(),
      endTime: windowEndUtc.toISOString(),
    });
    marks.GRAPH_COMPLETE = isoMark();
    timingMs.GRAPH_MS = Date.now() - graphStart;

    marks.AVAILABILITY_COMPUTE_STARTED = isoMark();
    const computeStart = Date.now();
    const maxSlots = Math.max(1, Math.min(12, input.maxSlots ?? 8));
    const filteredStarts = avail.slots.filter((s) => {
      const t = new Date(s.startTime).getTime();
      return t >= windowStartUtc.getTime() && t < windowEndUtc.getTime();
    });
    const slots = mapCalendlyAvailabilityToVoiceV2Slots({
      slots: filteredStarts,
      timezone,
      durationMinutes: calCfg.durationMinutes,
      eventTypeUri: calCfg.eventTypeUri,
      maxSlots,
    });
    marks.AVAILABILITY_COMPUTE_COMPLETE = isoMark();
    timingMs.AVAILABILITY_COMPUTE_MS = Date.now() - computeStart;

    const graphMeta = {
      GRAPH_REQUEST_COUNT: 0,
      GRAPH_HTTP_STATUS: 0,
      TOKEN_REFRESH_REQUIRED: false,
    };

    marks.RESPONSE_SENT = isoMark();
    timingMs.TOTAL_MS = Date.now() - t0;

    if (!slots.length) {
      return {
        status: "NO_AVAILABILITY",
        slots: [],
        timing: marks,
        timing_ms: timingMs,
        graph: graphMeta,
      };
    }

    const callId =
      options?.voiceCallId ||
      (raw.call_id || raw.callId ? String(raw.call_id || raw.callId) : null);
    const persisted = await persistVoiceV2OfferSet({
      workspaceId: input.workspaceId,
      voiceCallId: callId,
      slots,
      serviceName,
      timezone,
      connectionId: null,
    });

    return {
      status: "AVAILABILITY_FOUND",
      offer_set_id: persisted.offerSetId,
      slots,
      timing: marks,
      timing_ms: timingMs,
      graph: graphMeta,
    };
  } catch (err) {
    marks.RESPONSE_SENT = isoMark();
    timingMs.TOTAL_MS = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "ERROR",
      error: msg.includes("CALENDLY_PLAN_REQUIRED") || /plan|403/i.test(msg)
        ? "calendly_plan_required"
        : msg.includes("CALENDLY_AUTH") || /auth|token/i.test(msg)
          ? "calendly_auth_failed"
          : msg,
      timing: marks,
      timing_ms: timingMs,
      graph: {
        GRAPH_REQUEST_COUNT: 0,
        GRAPH_HTTP_STATUS: 0,
        TOKEN_REFRESH_REQUIRED: false,
      },
    };
  }
}
