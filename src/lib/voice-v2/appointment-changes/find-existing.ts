import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { resolveMctbMicrosoftConnectionId } from "@/lib/mctb/ai-booking/microsoft-connection";
import {
  getValidAccessToken,
  hasOAuthTokens,
  listMicrosoftCalendarEvents,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import { wallTimeInZoneToUtc } from "@/lib/voice/calendar/timezone-slots";
import type { FindExistingAppointmentResult, ExistingAppointmentRef } from "./types";
import { storeAppointmentRefs } from "./ref-store";
import { resolveSessionKey } from "../intake/load-call-context";
import { getVoiceV2CallContext } from "../intake/session-store";

function formatSpokenLabel(start: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(start);
}

function parseYmd(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!m) return null;
  return new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00.000Z`);
}

export async function executeVoiceV2FindExistingAppointment(
  raw: Record<string, unknown>,
  workspaceId: string,
  options?: { agentId?: string | null },
): Promise<FindExistingAppointmentResult> {
  const intentRaw = String(raw.intent || "RESCHEDULE").toUpperCase();
  const intent = intentRaw === "CANCEL" ? "CANCEL" : "RESCHEDULE";
  const callId = String(raw.call_id || raw.callId || "").trim();
  const sessionKey = callId
    ? resolveSessionKey({ callControlId: callId, conversationId: null })
    : null;

  const agentId = options?.agentId?.trim() || String(raw.agent_id || "").trim();
  if (agentId) {
    const { voiceV2AppointmentChangeCapabilities } = await import("./capabilities");
    const caps = await voiceV2AppointmentChangeCapabilities({ workspaceId, agentId });
    if (intent === "CANCEL" && !caps.cancel) {
      return { status: "ERROR", error: "cancel_not_enabled" };
    }
    if (intent === "RESCHEDULE" && !caps.reschedule) {
      return { status: "ERROR", error: "reschedule_not_enabled" };
    }
  }

  const bookingCfg = await loadMctbAiBookingConfig(workspaceId);
  const timezone = bookingCfg.timezone?.trim() || "America/New_York";
  const connectionId = await resolveMctbMicrosoftConnectionId(
    workspaceId,
    bookingCfg.calendarId || bookingCfg.providerConnectionId,
  );
  if (!connectionId) return { status: "ERROR", error: "microsoft_connection_not_found" };

  const prisma = getPrisma();
  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: "microsoft" },
  });
  if (!conn || conn.status !== "connected") {
    return { status: "ERROR", error: "microsoft_connection_not_connected" };
  }
  const config = (conn.config || {}) as CalendarConfig;

  const ctx = sessionKey ? getVoiceV2CallContext(sessionKey) : null;
  const phone =
    ctx?.intakeState?.phone?.value ||
    String(raw.caller_phone || raw.phone || raw.from || "").trim();
  const email = ctx?.intakeState?.email?.value || String(raw.email || "").trim();
  const name = ctx?.intakeState?.name?.value || String(raw.name || "").trim();

  const requestedDate = String(raw.appointment_date || raw.requested_date || "").trim();
  const now = new Date();
  let rangeStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let rangeEnd = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  if (requestedDate) {
    const mid = parseYmd(requestedDate);
    if (mid) {
      const parts = requestedDate.split("-").map(Number);
      rangeStart = wallTimeInZoneToUtc(timezone, parts[0], parts[1], parts[2], 0, 0);
      rangeEnd = wallTimeInZoneToUtc(timezone, parts[0], parts[1], parts[2], 23, 59);
      rangeEnd = new Date(rangeEnd.getTime() + 60_000);
    }
  }

  const localMatches: ExistingAppointmentRef[] = [];
  const appts = await prisma.voiceAppointment.findMany({
    where: {
      workspaceId,
      status: { not: "cancelled" },
      startsAt: { gte: rangeStart, lte: rangeEnd },
    },
    orderBy: { startsAt: "asc" },
    take: 20,
  });

  for (const row of appts) {
    if (!row.externalId) continue;
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const spoken = formatSpokenLabel(row.startsAt, row.timezone || timezone);
    localMatches.push({
      refId: `v2appt_${createId()}`,
      provider: "microsoft",
      providerEventId: row.externalId,
      connectionId: conn.id,
      timezone: row.timezone || timezone,
      startsAtUtc: row.startsAt.toISOString(),
      endsAtUtc: row.endsAt.toISOString(),
      serviceName: row.serviceName || undefined,
      voiceAppointmentId: row.id,
      eventKind: "single",
      spokenLabel: `${row.serviceName || "Appointment"} — ${spoken}`,
    });
  }

  let providerMatches: ExistingAppointmentRef[] = [];
  if (hasOAuthTokens(config)) {
    const token = await getValidAccessToken(conn.id, "microsoft", config);
    if (token) {
      const events = await listMicrosoftCalendarEvents(token, rangeStart, rangeEnd, undefined, {
        connectionId: conn.id,
        config,
      });
      for (const ev of events) {
        if (ev.status === "cancelled") continue;
        if (ev.type === "seriesMaster") continue;
        const spoken = formatSpokenLabel(ev.start, ev.timezone || timezone);
        const already = localMatches.some((m) => m.providerEventId === ev.id);
        if (already) continue;
        providerMatches.push({
          refId: `v2appt_${createId()}`,
          provider: "microsoft",
          providerEventId: ev.id,
          connectionId: conn.id,
          timezone: ev.timezone || timezone,
          startsAtUtc: ev.start.toISOString(),
          endsAtUtc: ev.end.toISOString(),
          serviceName: ev.summary,
          eventKind: ev.type === "occurrence" ? "occurrence" : "single",
          spokenLabel: `${ev.summary || "Appointment"} — ${spoken}`,
        });
      }
    }
  }

  const combined = [...localMatches, ...providerMatches];

  const narrowed = combined.filter((ref) => {
    if (requestedDate) {
      const d = new Date(ref.startsAtUtc);
      const local = new Intl.DateTimeFormat("en-CA", {
        timeZone: ref.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
      if (local !== requestedDate) return false;
    }
    return true;
  });

  const matches = (narrowed.length ? narrowed : combined).slice(0, 8);

  if (!matches.length) {
    return {
      status: "NONE",
      message: "I could not find an upcoming appointment with those details.",
    };
  }

  if (matches.length === 1) {
    const ref = matches[0]!;
    if (sessionKey) {
      storeAppointmentRefs({ sessionKey, intent, refs: [ref], selectedRefId: ref.refId });
    }
    return {
      status: "FOUND_ONE",
      appointment_ref_id: ref.refId,
      spoken_label: ref.spokenLabel,
    };
  }

  if (sessionKey) {
    storeAppointmentRefs({ sessionKey, intent, refs: matches });
  }
  return {
    status: "MULTIPLE",
    choices: matches.map((m) => ({
      appointment_ref_id: m.refId,
      spoken_label: m.spokenLabel,
    })),
  };
}
