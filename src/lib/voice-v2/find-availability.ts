import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { resolveMctbMicrosoftConnectionId } from "@/lib/mctb/ai-booking/microsoft-connection";
import { slotIdFor } from "@/lib/mctb/ai-booking/slot-id";
import { parseBookingHours } from "@/lib/solutions/appointment-receptionist/notice-utils";
import {
  computeFreeSlots,
  getMicrosoftBusy,
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import { wallTimeInZoneToUtc } from "@/lib/voice/calendar/timezone-slots";
import { validateVoiceV2FindAvailabilityInput } from "./validate-input";
import type {
  VoiceV2FindAvailabilityResult,
  VoiceV2Slot,
  VoiceV2TimingMarks,
  VoiceV2TimingMs,
} from "./types";
import {
  beginVoiceV2GraphCollection,
  endVoiceV2GraphCollection,
  type VoiceV2GraphSpan,
} from "./graph-instrumentation";
import { persistVoiceV2OfferSet } from "./offer-set-store";
import { subtractBusyInterval } from "./appointment-changes/busy-exclude";
import { getAppointmentActionState } from "./appointment-changes/ref-store";
import { resolveVoiceV2ContextForFind } from "./resolve-context-for-find";
import { executeVoiceV2FindAvailabilityCalendly } from "./find-availability-calendly";
import type { VoiceV2BookingStrategy } from "./booking-strategy";

function isoMark(): string {
  return new Date().toISOString();
}

function parseYmd(date: string): { year: number; month: number; day: number } {
  const [y, m, d] = date.split("-").map((x) => Number(x));
  return { year: y, month: m, day: d };
}

function parseHm(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map((x) => Number(x));
  return { hour: h, minute: m };
}

function formatSlotLabel(startUtc: string, timezone: string): string {
  const d = new Date(startUtc);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
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

/**
 * Voice Booking V2 — direct Microsoft availability baseline (no orchestrator, no durable ops).
 */
export async function executeVoiceV2FindAvailability(
  raw: Record<string, unknown>,
  resolvedWorkspaceId: string,
  options?: { voiceCallId?: string | null; trustedPrismaCallId?: string | null },
): Promise<VoiceV2FindAvailabilityResult> {
  const t0 = Date.now();
  const marks: VoiceV2TimingMarks = { REQUEST_RECEIVED: isoMark() };
  const timingMs = emptyTimingMs();
  const graphSpans: VoiceV2GraphSpan[] = [];
  let tokenRefreshRequired = false;
  let graphHttpStatus = 0;

  try {
    const vStart = Date.now();
    const input = validateVoiceV2FindAvailabilityInput(raw, resolvedWorkspaceId);
    marks.INPUT_VALIDATED = isoMark();
    timingMs.VALIDATION_MS = Date.now() - vStart;

    const agentId = String(raw.agent_id || raw.agentId || "").trim();
    let bookingStrategy: VoiceV2BookingStrategy = "MICROSOFT_365";
    if (agentId) {
      const sessionKey = resolveSessionKey({
        callControlId: options?.voiceCallId || String(raw.call_id || raw.callId || ""),
        conversationId: String(raw.conversation_id || raw.conversationId || ""),
      });
      const ctx = sessionKey ? getVoiceV2CallContext(sessionKey) : null;
      const gate = await (
        await import("./authorize-find-book")
      ).assertVoiceV2FindBookAllowed({
        workspaceId: input.workspaceId,
        agentId,
        ctx,
      });
      if (!gate.allowed) {
        return {
          status: "ERROR",
          error: gate.status,
          timing: marks,
          timing_ms: timingMs,
          graph: {
            GRAPH_REQUEST_COUNT: 0,
            GRAPH_HTTP_STATUS: 0,
            TOKEN_REFRESH_REQUIRED: false,
          },
        };
      }
      bookingStrategy = gate.strategy;
      const qualGate = await (
        await import("./qualification-gate")
      ).evaluateQualificationPrimaryActionGate({
        workspaceId: input.workspaceId,
        agentId,
        ctx,
      });
      if (!qualGate.allowed) {
        return {
          status: "ERROR",
          error: qualGate.status,
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

    if (bookingStrategy === "CALENDLY") {
      return executeVoiceV2FindAvailabilityCalendly(raw, resolvedWorkspaceId, options);
    }

    const wsStart = Date.now();
    const bookingCfg = await loadMctbAiBookingConfig(input.workspaceId);
    const timezone = bookingCfg.timezone?.trim() || "America/New_York";
    const serviceName = input.serviceName || bookingCfg.serviceName || "Consultation";
    marks.WORKSPACE_RESOLVED = isoMark();
    timingMs.WORKSPACE_RESOLUTION_MS = Date.now() - wsStart;

    const connStart = Date.now();
    const connectionId = await resolveMctbMicrosoftConnectionId(
      input.workspaceId,
      bookingCfg.calendarId || bookingCfg.providerConnectionId,
    );
    if (!connectionId) {
      throw new Error("microsoft_connection_not_found");
    }
    const prisma = getPrisma();
    const conn = await prisma.voiceCalendarConnection.findFirst({
      where: { id: connectionId, workspaceId: input.workspaceId, provider: "microsoft" },
    });
    if (!conn || conn.status !== "connected") {
      throw new Error("microsoft_connection_not_connected");
    }
    const config = (conn.config || {}) as CalendarConfig;
    if (!hasOAuthTokens(config)) {
      throw new Error("microsoft_oauth_tokens_missing");
    }
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

    marks.TOKEN_STARTED = isoMark();
    const tokenStart = Date.now();
    const expiresAt = Number(config.expiresAt || 0);
    tokenRefreshRequired = !expiresAt || expiresAt <= Date.now() + 120_000;
    const token = await getValidAccessToken(conn.id, "microsoft", config);
    if (!token) throw new Error("microsoft_token_unavailable");
    marks.TOKEN_COMPLETE = isoMark();
    timingMs.TOKEN_MS = Date.now() - tokenStart;

    marks.GRAPH_STARTED = isoMark();
    const graphStart = Date.now();
    beginVoiceV2GraphCollection((span) => graphSpans.push(span));
    let busy: Array<{ start: Date; end: Date }>;
    try {
      busy = await getMicrosoftBusy(token, windowStartUtc, windowEndUtc, {
        ctx: { connectionId: conn.id, config },
        smtp: config.email,
      });
      graphHttpStatus = graphSpans[graphSpans.length - 1]?.status ?? 200;
    } finally {
      endVoiceV2GraphCollection();
    }
    marks.GRAPH_COMPLETE = isoMark();
    timingMs.GRAPH_MS = Date.now() - graphStart;

    const callControlId =
      options?.voiceCallId ||
      (raw.call_id || raw.callId ? String(raw.call_id || raw.callId) : null);
    const conversationId =
      raw.conversation_id || raw.conversationId
        ? String(raw.conversation_id || raw.conversationId)
        : null;
    if (callControlId || conversationId || options?.trustedPrismaCallId) {
      const ctx = await resolveVoiceV2ContextForFind({
        callControlId,
        conversationId,
        trustedPrismaCallId: options?.trustedPrismaCallId,
      });
      const action = getAppointmentActionState(ctx);
      const refId =
        String(raw.appointment_ref_id || "").trim() ||
        action?.selectedRefId ||
        "";
      const ref = refId && action?.refsById?.[refId] ? action.refsById[refId] : null;
      if (ref && action?.intent === "RESCHEDULE") {
        busy = subtractBusyInterval(busy, {
          start: new Date(ref.startsAtUtc),
          end: new Date(ref.endsAtUtc),
        });
      }
    }

    marks.AVAILABILITY_COMPUTE_STARTED = isoMark();
    const computeStart = Date.now();
    const service = await prisma.voiceService.findFirst({
      where: { workspaceId: input.workspaceId, name: serviceName },
    });
    const svcCfg = (service?.config || {}) as Record<string, unknown>;
    const durationMinutes = service?.durationMinutes || bookingCfg.durationMinutes || 30;
    const bufferMinutes = service?.bufferMinutes || 0;
    const hours = parseBookingHours(
      typeof svcCfg.bookingHours === "string" ? svcCfg.bookingHours : undefined,
    );

    const { listAuthoritativeVoiceAppointmentBusyIntervals } = await import(
      "@/lib/voice/calendar/voice-appointment-reconcile"
    );
    const ledgerBusy = await listAuthoritativeVoiceAppointmentBusyIntervals(
      input.workspaceId,
      windowStartUtc,
      windowEndUtc,
      bufferMinutes,
    );
    if (ledgerBusy.length) {
      busy = busy.concat(ledgerBusy);
    }

    const rawSlots = computeFreeSlots(
      busy,
      durationMinutes,
      1,
      windowStartUtc,
      bufferMinutes,
      {
        timezone,
        startHour: hours?.startHour,
        endHour: hours?.endHour,
        weekdaysOnly: hours?.weekdaysOnly,
      },
    );

    const maxSlots = Math.max(1, Math.min(12, input.maxSlots ?? 8));
    const filtered = rawSlots
      .filter((s) => {
        const start = new Date(s.startsAt);
        return start >= windowStartUtc && start < windowEndUtc;
      })
      .slice(0, maxSlots);

    const slots: VoiceV2Slot[] = filtered.map((s) => {
      const spoken = formatSlotLabel(s.startsAt, timezone);
      return {
        slot_id: slotIdFor(s.startsAt, s.endsAt, "microsoft"),
        label: spoken,
        spoken_label: spoken,
        start_utc: s.startsAt,
        end_utc: s.endsAt,
      };
    });
    marks.AVAILABILITY_COMPUTE_COMPLETE = isoMark();
    timingMs.AVAILABILITY_COMPUTE_MS = Date.now() - computeStart;

    marks.RESPONSE_SENT = isoMark();
    timingMs.TOTAL_MS = Date.now() - t0;

    const graphMeta = {
      GRAPH_REQUEST_COUNT: graphSpans.length > 0 ? graphSpans.length : 1,
      GRAPH_HTTP_STATUS:
        graphSpans.length > 0 ? graphSpans[graphSpans.length - 1]!.status : graphHttpStatus || 200,
      TOKEN_REFRESH_REQUIRED: tokenRefreshRequired,
      GRAPH_REQUESTS: graphSpans,
    };

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
      connectionId: conn.id,
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
    return {
      status: "ERROR",
      error: err instanceof Error ? err.message : String(err),
      timing: marks,
      timing_ms: timingMs,
      graph: {
        GRAPH_REQUEST_COUNT: graphSpans.length,
        GRAPH_HTTP_STATUS: graphHttpStatus,
        TOKEN_REFRESH_REQUIRED: tokenRefreshRequired,
      },
    };
  }
}
