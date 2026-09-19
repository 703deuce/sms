import { createId } from "@/lib/supabase/id";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type {
  ExistingAppointment,
  ExistingAppointmentCandidateSet,
  FindExistingAppointmentRequest,
  FindExistingAppointmentResult,
} from "./appointment-management-types";
import { lookupActiveAppointments } from "./durable-booking-store";
import { verifyCallerForCandidates } from "./verify-appointment-caller";
import { buildFindExistingAppointmentWindow } from "./find-existing-appointment-window";

function matchesDateHint(appointment: ExistingAppointment, localDate: string | null | undefined): boolean {
  if (!localDate) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(localDate.trim())) {
    return appointment.localStart.startsWith(localDate.trim());
  }
  return appointment.localStart.includes(localDate) || appointment.localStart.startsWith(localDate);
}

function dedupeByProviderEventId(appointments: ExistingAppointment[]): ExistingAppointment[] {
  const seen = new Set<string>();
  const out: ExistingAppointment[] = [];
  for (const a of appointments) {
    const key = `${a.providerCalendarId}|${a.providerEventId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

function finalizeFindResult(
  verified: ExistingAppointment[],
  dateHintLocal: string | null | undefined,
): FindExistingAppointmentResult {
  const dateFiltered = verified.filter((a) => matchesDateHint(a, dateHintLocal));

  if (dateFiltered.length === 0) {
    return { status: "NONE" };
  }

  if (dateFiltered.length === 1) {
    return { status: "FOUND", appointment: dateFiltered[0]! };
  }

  const candidateSet: ExistingAppointmentCandidateSet = {
    candidateSetId: `cand_set_${createId()}`,
    createdAt: new Date().toISOString(),
    candidates: dateFiltered.map((appointment, i) => ({
      candidateId: `cand_${i + 1}`,
      appointment,
    })),
  };

  return { status: "MULTIPLE", candidateSet };
}

function resolveDateHintLocal(request: FindExistingAppointmentRequest): string | null | undefined {
  if (request.dateExpression?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(request.dateExpression.trim())) {
    return request.dateExpression.trim();
  }
  return request.dateHint?.localDate ?? null;
}

function findFromDurableStore(request: FindExistingAppointmentRequest): ExistingAppointment[] {
  const raw = lookupActiveAppointments({
    phone: request.phone,
    email: request.email,
  });
  return verifyCallerForCandidates(raw, {
    phone: request.phone,
    email: request.email,
  });
}

/**
 * Locate existing appointments: durable Transovo store + optional Microsoft calendarView.
 */
export async function findExistingAppointment(
  request: FindExistingAppointmentRequest,
  config?: VoiceV3AgentConfig,
): Promise<FindExistingAppointmentResult> {
  if (!request.phone?.trim() && !request.email?.trim()) {
    return { status: "VERIFICATION_FAILED", reason: "missing_phone_or_email" };
  }

  let merged = findFromDurableStore(request);

  const shouldQueryMicrosoft = request.microsoftLookup !== false && config?.calendar?.connectionId;
  if (shouldQueryMicrosoft && config) {
    const { resolveVoiceV3MicrosoftCalendar } = await import(
      "./microsoft/resolve-voice-v3-microsoft-calendar"
    );
    const { fetchMicrosoftExistingAppointments } = await import(
      "./microsoft/microsoft-find-existing-appointments"
    );
    const resolved = await resolveVoiceV3MicrosoftCalendar(config);
    if (resolved.ok) {
      const timezone = request.timezone ?? "America/New_York";
      const window = buildFindExistingAppointmentWindow({
        timezone,
        dateHint: request.dateHint,
        dateExpression: request.dateExpression,
        durationMinutes: config.service.durationMinutes,
      });
      const graph = await fetchMicrosoftExistingAppointments({
        connectionId: resolved.connectionId,
        calendarConfig: resolved.calendarConfig,
        calendarIds: resolved.calendarIds,
        rangeStartUtc: window.rangeStartUtc,
        rangeEndUtc: window.rangeEndUtc,
        timezone,
        caller: { phone: request.phone, email: request.email },
      });
      if (graph.ok) {
        merged = dedupeByProviderEventId([...merged, ...graph.appointments]);
        merged = verifyCallerForCandidates(merged, {
          phone: request.phone,
          email: request.email,
        });
      }
    }
  }

  return finalizeFindResult(merged, resolveDateHintLocal(request));
}

/** Store-only lookup (tests / deterministic harness). */
export function findExistingAppointmentFromStore(
  request: FindExistingAppointmentRequest,
): FindExistingAppointmentResult {
  if (!request.phone?.trim() && !request.email?.trim()) {
    return { status: "VERIFICATION_FAILED", reason: "missing_phone_or_email" };
  }
  const verified = findFromDurableStore(request);
  return finalizeFindResult(verified, resolveDateHintLocal(request));
}

export function appointmentSelectionId(appointment: ExistingAppointment): string {
  return appointment.internalBookingId;
}

export function resolveVerifiedAppointmentBySelectionId(
  selectionId: string | null | undefined,
  verified: ExistingAppointment | null,
  candidateSet: ExistingAppointmentCandidateSet | null,
): ExistingAppointment | null {
  if (!selectionId?.trim()) return verified;
  if (verified && appointmentSelectionId(verified) === selectionId.trim()) return verified;
  if (verified && verified.providerEventId === selectionId.trim()) {
    return null;
  }
  if (candidateSet) {
    const hit = candidateSet.candidates.find(
      (c) =>
        appointmentSelectionId(c.appointment) === selectionId.trim() ||
        c.candidateId === selectionId.trim(),
    );
    return hit?.appointment ?? null;
  }
  return null;
}
