import "server-only";

import type { AgentConfig } from "@/lib/agent";
import { resolveSchedulingBackend } from "./connections";
import type { AppointmentCandidate, FindAppointmentIdentity } from "./appointment-types";
import { rankAppointmentCandidates, selectionIdFor } from "./appointment-match";
import type { SchedulingSessionState } from "./service";
import * as calendly from "./calendly";
import * as google from "./google";
import * as microsoft from "./microsoft-oauth";
import { schedulingCapsForBackend } from "./provider-capabilities";

function spokenLabel(startIso: string, timezone: string): string {
  return new Date(startIso).toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function listCandidates(input: {
  workspaceId: string;
  editor: AgentConfig;
  timezone: string;
}): Promise<AppointmentCandidate[]> {
  const backend = await resolveSchedulingBackend(input.workspaceId, input.editor);
  if (!backend.ok) {
    throw new Error(backend.message);
  }
  const rangeStart = new Date(Date.now() - 7 * 86400000);
  const rangeEnd = new Date(Date.now() + 60 * 86400000);
  const caps = schedulingCapsForBackend(backend);
  if (!caps.findAppointment) return [];

  if (backend.provider === "calendly") {
    const rows = await calendly.calendlyListScheduledEvents({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      rangeStart,
      rangeEnd,
    });
    return rows.map((r, i) => ({
      selectionId: selectionIdFor(i, r.uri),
      provider: "calendly",
      providerEventId: r.uri,
      startTimeIso: r.startTimeIso,
      endTimeIso: r.endTimeIso,
      title: r.name,
      spokenLabel: spokenLabel(r.startTimeIso, input.timezone),
      attendeeEmail: r.inviteeEmail,
    }));
  }

  if (backend.provider === "microsoft") {
    const rows = await microsoft.microsoftListEvents({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      calendarId: backend.calendarId,
      rangeStart,
      rangeEnd,
    });
    return rows.map((r, i) => ({
      selectionId: selectionIdFor(i, r.id),
      provider: "microsoft",
      providerEventId: r.id,
      startTimeIso: r.startIso,
      endTimeIso: r.endIso,
      title: r.subject,
      spokenLabel: spokenLabel(r.startIso, input.timezone),
      attendeeEmail: r.attendeeEmail,
    }));
  }

  const rows = await google.googleListEvents({
    workspaceId: input.workspaceId,
    connectionId: backend.connectionId,
    calendarId: backend.calendarId,
    rangeStart,
    rangeEnd,
  });
  return rows.map((r, i) => ({
    selectionId: selectionIdFor(i, r.id),
    provider: "google",
    providerEventId: r.id,
    startTimeIso: r.startIso,
    endTimeIso: r.endIso,
    title: r.summary,
    spokenLabel: spokenLabel(r.startIso, input.timezone),
    attendeeEmail: r.attendeeEmail,
    attendeePhone: r.attendeePhone,
  }));
}

export async function findAppointment(input: {
  workspaceId: string;
  editor: AgentConfig;
  timezone: string;
  identity: FindAppointmentIdentity;
  state: SchedulingSessionState;
  appointmentSelectionId?: string | null;
  confirmSelection?: boolean;
}) {
  const backend = await resolveSchedulingBackend(input.workspaceId, input.editor);
  if (!backend.ok) {
    return { ok: false as const, code: backend.code, message: backend.message };
  }
  const caps = schedulingCapsForBackend(backend);
  if (!caps.findAppointment) {
    return {
      ok: false as const,
      code: "provider_limit",
      message: "This calendar provider does not support appointment lookup.",
    };
  }

  if (input.confirmSelection) {
    const id = input.appointmentSelectionId?.trim();
    const pool = input.state.candidateAppointments || [];
    const selected = id
      ? pool.find((c) => c.selectionId === id)
      : pool.length === 1
        ? pool[0]
        : input.state.verifiedAppointment;
    if (!selected) {
      return {
        ok: false as const,
        code: "invalid_selection",
        message: "appointment_selection_id is not valid for this call.",
      };
    }
    input.state.verifiedAppointment = selected;
    return {
      ok: true as const,
      status: "verified",
      appointment: selected,
    };
  }

  const all = await listCandidates(input);
  const ranked = rankAppointmentCandidates(all, input.identity);
  input.state.candidateAppointments = ranked;

  if (!ranked.length) {
    return {
      ok: true as const,
      status: "not_found",
      message: "No upcoming appointments matched. Ask for name, email, or when the appointment is scheduled.",
      candidates: [],
    };
  }

  if (ranked.length === 1) {
    return {
      ok: true as const,
      status: "needs_confirmation",
      candidates: ranked,
      suggested_selection_id: ranked[0].selectionId,
      spoken: ranked[0].spokenLabel,
    };
  }

  return {
    ok: true as const,
    status: "needs_selection",
    candidates: ranked.slice(0, 5).map((c) => ({
      appointment_selection_id: c.selectionId,
      spoken: c.spokenLabel,
      title: c.title,
    })),
  };
}

export async function rescheduleAppointment(input: {
  workspaceId: string;
  editor: AgentConfig;
  slotId: string;
  state: SchedulingSessionState;
}) {
  const verified = input.state.verifiedAppointment;
  if (!verified) {
    return {
      ok: false as const,
      code: "no_verified_appointment",
      message: "Call find_appointment and confirm_selection before rescheduling.",
    };
  }

  const slot =
    input.state.lastOfferedSlots?.find((s) => s.slotId === input.slotId) ||
    input.state.lastOfferedSlots?.[0];
  if (!slot) {
    return {
      ok: false as const,
      code: "no_slot_selected",
      message: "Call find_availability and have the caller pick a slot first.",
    };
  }

  const backend = await resolveSchedulingBackend(input.workspaceId, input.editor);
  if (!backend.ok) {
    return { ok: false as const, code: backend.code, message: backend.message };
  }
  const caps = schedulingCapsForBackend(backend);
  if (!caps.rescheduleAppointment) {
    return {
      ok: false as const,
      code: "provider_limit",
      message: "Reschedule is not supported for Calendly in this runtime — cancel and book a new time instead.",
    };
  }

  const durationMin = slot.durationMin || 30;
  const endIso = new Date(
    new Date(slot.startTimeIso).getTime() + durationMin * 60_000,
  ).toISOString();

  if (verified.provider === "microsoft" && backend.provider === "microsoft") {
    await microsoft.microsoftPatchEventTimes({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      calendarId: backend.calendarId,
      eventId: verified.providerEventId,
      startIso: slot.startTimeIso,
      endIso,
    });
  } else if (verified.provider === "google" && backend.provider === "google") {
    await google.googlePatchEventTimes({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      calendarId: backend.calendarId,
      eventId: verified.providerEventId,
      startIso: slot.startTimeIso,
      endIso,
    });
  } else {
    return {
      ok: false as const,
      code: "provider_limit",
      message: "Reschedule not supported for this provider.",
    };
  }

  verified.startTimeIso = slot.startTimeIso;
  verified.endTimeIso = endIso;
  input.state.verifiedAppointment = verified;
  return { ok: true as const, provider: verified.provider, startTimeIso: slot.startTimeIso };
}

export async function cancelAppointment(input: {
  workspaceId: string;
  editor: AgentConfig;
  state: SchedulingSessionState;
  confirmed: boolean;
}) {
  if (!input.confirmed) {
    return {
      ok: false as const,
      code: "confirmation_required",
      message: "Set confirmed=true only after the caller explicitly agrees to cancel.",
    };
  }
  const verified = input.state.verifiedAppointment;
  if (!verified) {
    return {
      ok: false as const,
      code: "no_verified_appointment",
      message: "Call find_appointment and confirm_selection before cancel_appointment.",
    };
  }

  const backend = await resolveSchedulingBackend(input.workspaceId, input.editor);
  if (!backend.ok) {
    return { ok: false as const, code: backend.code, message: backend.message };
  }
  const caps = schedulingCapsForBackend(backend);
  if (!caps.cancelAppointment) {
    return {
      ok: false as const,
      code: "provider_limit",
      message: "Cancellation is not supported for this calendar provider.",
    };
  }

  if (verified.provider === "calendly") {
    await calendly.calendlyCancelScheduledEvent({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      eventUri: verified.providerEventId,
    });
  } else if (verified.provider === "microsoft") {
    await microsoft.microsoftDeleteEvent({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      eventId: verified.providerEventId,
    });
  } else if (verified.provider === "google" && backend.provider === "google") {
    await google.googleDeleteEvent({
      workspaceId: input.workspaceId,
      connectionId: backend.connectionId,
      calendarId: backend.calendarId,
      eventId: verified.providerEventId,
    });
  }

  input.state.verifiedAppointment = undefined;
  return { ok: true as const, cancelled: true, provider: verified.provider };
}
