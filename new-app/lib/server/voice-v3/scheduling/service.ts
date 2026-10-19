import "server-only";

import type { AgentConfig } from "@/lib/agent";
import { resolveSchedulingBackend } from "./connections";
import * as calendly from "./calendly";
import * as microsoft from "./microsoft-oauth";
import * as google from "./google";

export type SchedulingSessionState = {
  preference?: { serviceId?: string | null; timezone?: string };
  lastOfferedSlots?: { slotId: string; startTimeIso: string; durationMin: number }[];
  lastBookedEventId?: string;
};

function generateSlotsFromBusy(input: {
  busy: { start: string; end: string }[];
  durationMin: number;
  rangeStart: Date;
  rangeEnd: Date;
  timezone: string;
  maxSlots: number;
}) {
  const slots: { slotId: string; startTimeIso: string; durationMin: number; spokenLabel: string }[] = [];
  const stepMs = 30 * 60_000;
  let cursor = input.rangeStart.getTime();
  const endMs = input.rangeEnd.getTime();
  while (cursor + input.durationMin * 60_000 <= endMs && slots.length < input.maxSlots) {
    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor + input.durationMin * 60_000);
    const overlaps = input.busy.some((b) => {
      const bs = new Date(b.start).getTime();
      const be = new Date(b.end).getTime();
      return slotStart.getTime() < be && slotEnd.getTime() > bs;
    });
    if (!overlaps) {
      const startTimeIso = slotStart.toISOString();
      slots.push({
        slotId: `slot_${startTimeIso}`,
        startTimeIso,
        durationMin: input.durationMin,
        spokenLabel: slotStart.toLocaleString("en-US", {
          timeZone: input.timezone,
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      });
    }
    cursor += stepMs;
  }
  return slots;
}

export async function findAvailability(input: {
  workspaceId: string;
  editor: AgentConfig;
  timezone: string;
  serviceId?: string | null;
  state: SchedulingSessionState;
}) {
  const backend = await resolveSchedulingBackend(input.workspaceId, input.editor);
  if (!backend.ok) {
    return { ok: false as const, code: backend.code, message: backend.message };
  }

  const type =
    input.editor.appointments.types.find((t) => t.id === input.serviceId) ||
    input.editor.appointments.types.find((t) => t.enabled);
  const durationMin = type?.duration ?? 30;

  if (backend.provider === "calendly") {
    const slots = await calendly.calendlyListAvailableSlots({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      timezone: input.timezone,
      eventTypeUri: backend.eventTypeUri,
    });
    input.state.lastOfferedSlots = slots;
    return { ok: true as const, slots, linesForModel: slots.map((s) => s.spokenLabel).join("\n") };
  }

  const rangeStart = new Date();
  const rangeEnd = new Date(Date.now() + 14 * 86400000);
  let busy: { start: string; end: string }[] = [];
  if (backend.provider === "microsoft") {
    busy = await microsoft.microsoftGetBusy({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      calendarId: backend.calendarId,
      rangeStart,
      rangeEnd,
    });
  } else {
    busy = await google.googleFreeBusy({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      calendarId: backend.calendarId,
      rangeStart,
      rangeEnd,
    });
  }
  const slots = generateSlotsFromBusy({
    busy,
    durationMin,
    rangeStart,
    rangeEnd,
    timezone: input.timezone,
    maxSlots: 12,
  });
  input.state.lastOfferedSlots = slots;
  return { ok: true as const, slots, linesForModel: slots.map((s) => s.spokenLabel).join("\n") };
}

export async function bookAppointment(input: {
  workspaceId: string;
  editor: AgentConfig;
  slotId: string;
  attendeeName: string;
  attendeeEmail?: string;
  state: SchedulingSessionState;
}) {
  const slot =
    input.state.lastOfferedSlots?.find((s) => s.slotId === input.slotId) ||
    input.state.lastOfferedSlots?.[0];
  if (!slot) {
    return { ok: false as const, code: "no_slot_selected", message: "Call find_availability first." };
  }

  const backend = await resolveSchedulingBackend(input.workspaceId, input.editor);
  if (!backend.ok) {
    return { ok: false as const, code: backend.code, message: backend.message };
  }

  const type = input.editor.appointments.types.find((t) => t.enabled);
  const durationMin = slot.durationMin || type?.duration || 30;
  const endIso = new Date(
    new Date(slot.startTimeIso).getTime() + durationMin * 60_000,
  ).toISOString();

  if (backend.provider === "calendly") {
    const booked = await calendly.calendlyBookSlot({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      startTimeIso: slot.startTimeIso,
      inviteeEmail: input.attendeeEmail || "caller@placeholder.local",
      inviteeName: input.attendeeName,
      eventTypeUri: backend.eventTypeUri,
    });
    input.state.lastBookedEventId = booked.eventUri;
    return { ok: true as const, provider: "calendly", ...booked };
  }

  if (backend.provider === "microsoft") {
    const ev = await microsoft.microsoftCreateEvent({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      calendarId: backend.calendarId,
      subject: type?.name || "Appointment",
      startIso: slot.startTimeIso,
      endIso,
      attendeeEmail: input.attendeeEmail,
    });
    input.state.lastBookedEventId = ev.id;
    return { ok: true as const, provider: "microsoft", eventId: ev.id };
  }

  const ev = await google.googleCreateEvent({
    workspaceId: input.workspaceId,
    connectionId: backend.connectionId,
    calendarId: backend.calendarId,
    summary: type?.name || "Appointment",
    startIso: slot.startTimeIso,
    endIso,
    attendeeEmail: input.attendeeEmail,
  });
  input.state.lastBookedEventId = ev.id;
  return { ok: true as const, provider: "google", eventId: ev.id };
}
