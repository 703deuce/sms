import { createId } from "@/lib/supabase/id";
import type { VoiceV3AgentConfig } from "../config/agent-config";
import type {
  AppointmentDiscriminator,
  AppointmentLookupState,
  ExistingAppointment,
  ExistingAppointmentCandidateSet,
  FindExistingAppointmentRequest,
  FindExistingAppointmentResult,
} from "./appointment-management-types";
import { lookupActiveAppointments } from "./durable-booking-store";
import { buildFindExistingAppointmentWindow } from "./find-existing-appointment-window";
import {
  computeUsefulDiscriminators,
  eventRecordFromAppointment,
  hasAnyLookupConstraint,
  narrowAppointmentCandidates,
  type AppointmentDiscoveryRecord,
  type AppointmentLookupConstraints,
} from "./appointment-discovery-match";
import type { AppointmentWhenConstraint } from "./appointment-lookup-when";

function resolveDateHintLocal(request: FindExistingAppointmentRequest): string | null | undefined {
  if (request.dateExpression?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(request.dateExpression.trim())) {
    return request.dateExpression.trim();
  }
  return request.dateHint?.localDate ?? request.lookupState?.localDate ?? null;
}

function mergeAppointmentWhen(
  request: FindExistingAppointmentRequest,
): AppointmentWhenConstraint | null | undefined {
  return request.appointmentWhen ?? undefined;
}

function mergeLookupConstraints(request: FindExistingAppointmentRequest): AppointmentLookupConstraints {
  const prior = request.lookupState;
  const when = mergeAppointmentWhen(request);
  const localFromWhen = when?.normalized?.localDate ?? undefined;
  return {
    name: request.customerName?.trim() || prior?.name,
    phone: request.phone?.trim() || prior?.phone,
    email: request.email?.trim() || prior?.email,
    localDate: localFromWhen ?? resolveDateHintLocal(request) ?? undefined,
    service: request.service?.trim() || prior?.service,
    location: request.location?.trim() || prior?.location,
    ani: request.ani?.trim() || prior?.ani,
    when: when ?? null,
  };
}

function toLookupState(
  constraints: AppointmentLookupConstraints,
  generation: number,
  discriminators: AppointmentDiscriminator[],
): AppointmentLookupState {
  return {
    generation,
    name: constraints.name,
    phone: constraints.phone,
    email: constraints.email,
    localDate: constraints.localDate,
    service: constraints.service,
    location: constraints.location,
    ani: constraints.ani,
    lastUsefulDiscriminators: discriminators,
  };
}

function dedupeDiscoveryRecords(records: AppointmentDiscoveryRecord[]): AppointmentDiscoveryRecord[] {
  const seen = new Set<string>();
  const out: AppointmentDiscoveryRecord[] = [];
  for (const r of records) {
    const key = `${r.providerCalendarId}|${r.providerEventId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

function finalizeFromNarrowed(
  narrowed: AppointmentDiscoveryRecord[],
  lookupGeneration: number,
  constraints: AppointmentLookupConstraints,
): FindExistingAppointmentResult {
  if (narrowed.length === 0) {
    return { status: "NONE" };
  }

  const discriminators = computeUsefulDiscriminators(narrowed, constraints);

  if (narrowed.length === 1) {
    const one = narrowed[0]!;
    return {
      status: "FOUND",
      appointment: one,
      safeDisplay: one.safeDisplay,
      needsConfirmation: true,
    };
  }

  const candidateSet: ExistingAppointmentCandidateSet = {
    candidateSetId: `cand_set_${createId()}`,
    createdAt: new Date().toISOString(),
    candidates: narrowed.map((record, i) => ({
      candidateId: `cand_${i + 1}`,
      appointment: record,
    })),
  };

  return {
    status: "MULTIPLE",
    candidateSet,
    usefulDiscriminators: discriminators,
  };
}

async function loadGoogleCandidates(
  request: FindExistingAppointmentRequest,
  config: VoiceV3AgentConfig,
): Promise<AppointmentDiscoveryRecord[]> {
  const { resolveVoiceV3GoogleCalendar } = await import("./google/resolve-voice-v3-google-calendar");
  const { fetchGoogleAppointmentDiscoveryCandidates } = await import(
    "./google/google-find-existing-appointments"
  );
  const resolved = await resolveVoiceV3GoogleCalendar(config);
  if (!resolved.ok) return [];

  const timezone = request.timezone ?? config.timezone ?? "America/New_York";
  const when = mergeAppointmentWhen(request);
  const window = buildFindExistingAppointmentWindow({
    timezone,
    dateHint: request.dateHint,
    appointmentWhen: when,
    dateExpression: request.dateExpression ?? request.lookupState?.localDate,
    durationMinutes: config.service.durationMinutes,
  });

  const graph = await fetchGoogleAppointmentDiscoveryCandidates({
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
    calendarIds: resolved.calendarIds,
    rangeStartUtc: window.rangeStartUtc,
    rangeEndUtc: window.rangeEndUtc,
    timezone,
  });
  if (!graph.ok) {
    console.log("APPOINTMENT_DISCOVERY_GOOGLE_FAILED", {
      call_id: request.callId,
      reason: graph.reason,
      message: graph.message,
      duration_ms: graph.durationMs,
    });
    return [];
  }
  return graph.candidates;
}

async function loadMicrosoftCandidates(
  request: FindExistingAppointmentRequest,
  config: VoiceV3AgentConfig,
): Promise<AppointmentDiscoveryRecord[]> {
  const { resolveVoiceV3MicrosoftCalendar } = await import(
    "./microsoft/resolve-voice-v3-microsoft-calendar"
  );
  const { fetchMicrosoftAppointmentDiscoveryCandidates } = await import(
    "./microsoft/microsoft-find-existing-appointments"
  );
  const resolved = await resolveVoiceV3MicrosoftCalendar(config);
  if (!resolved.ok) return [];

  const timezone = request.timezone ?? config.timezone ?? "America/New_York";
  const when = mergeAppointmentWhen(request);
  const window = buildFindExistingAppointmentWindow({
    timezone,
    dateHint: request.dateHint,
    appointmentWhen: when,
    dateExpression: request.dateExpression ?? request.lookupState?.localDate,
    durationMinutes: config.service.durationMinutes,
  });

  const graph = await fetchMicrosoftAppointmentDiscoveryCandidates({
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
    calendarIds: resolved.calendarIds,
    rangeStartUtc: window.rangeStartUtc,
    rangeEndUtc: window.rangeEndUtc,
    timezone,
  });
  if (!graph.ok) {
    console.log("APPOINTMENT_DISCOVERY_GRAPH_FAILED", {
      call_id: request.callId,
      reason: graph.reason,
      message: graph.message,
      duration_ms: graph.durationMs,
    });
    return [];
  }
  return graph.candidates;
}

function loadStoreCandidates(request: FindExistingAppointmentRequest, timezone: string): AppointmentDiscoveryRecord[] {
  const raw = lookupActiveAppointments({
    phone: request.phone,
    email: request.email,
  });
  return raw.map((a) => eventRecordFromAppointment(a, timezone));
}

/**
 * Locate existing appointments: durable store (fast path) + Microsoft calendarView + progressive matching.
 */
export async function findExistingAppointment(
  request: FindExistingAppointmentRequest,
  config?: VoiceV3AgentConfig,
): Promise<FindExistingAppointmentResult> {
  const constraints = mergeLookupConstraints(request);
  const lookupGeneration = (request.lookupState?.generation ?? 0) + 1;

  if (!hasAnyLookupConstraint(constraints)) {
    return {
      status: "NEEDS_MORE_INFORMATION",
      usefulDiscriminators: ["name", "phone", "email"],
    };
  }

  const timezone = request.timezone ?? config?.timezone ?? "America/New_York";
  let pool: AppointmentDiscoveryRecord[] = loadStoreCandidates(request, timezone);

  const shouldQueryCalendar =
    request.microsoftLookup !== false && config?.calendar?.connectionId;
  if (shouldQueryCalendar && config) {
    const provider = config.calendar?.provider;
    const calendarCandidates =
      provider === "google"
        ? await loadGoogleCandidates(request, config)
        : await loadMicrosoftCandidates(request, config);
    pool = dedupeDiscoveryRecords([...pool, ...calendarCandidates]);
  }

  const narrowed = narrowAppointmentCandidates(pool, constraints);
  const result = finalizeFromNarrowed(narrowed, lookupGeneration, constraints);

  if (result.status === "MULTIPLE" || result.status === "NEEDS_MORE_INFORMATION") {
    return result;
  }
  if (result.status === "NONE" && pool.length > 0) {
    const discriminators = computeUsefulDiscriminators(pool, constraints);
    return {
      status: "NEEDS_MORE_INFORMATION",
      usefulDiscriminators: discriminators.length ? discriminators : ["name", "phone", "email"],
    };
  }
  return result;
}

export function nextLookupStateFromResult(
  request: FindExistingAppointmentRequest,
  result: FindExistingAppointmentResult,
): AppointmentLookupState {
  const constraints = mergeLookupConstraints(request);
  const generation = (request.lookupState?.generation ?? 0) + 1;
  if (result.status === "MULTIPLE") {
    return toLookupState(constraints, generation, result.usefulDiscriminators);
  }
  if (result.status === "NEEDS_MORE_INFORMATION") {
    return toLookupState(constraints, generation, result.usefulDiscriminators);
  }
  return toLookupState(constraints, generation, []);
}

/** Store-only lookup (legacy unit tests). */
export function findExistingAppointmentFromStore(
  request: FindExistingAppointmentRequest,
): FindExistingAppointmentResult {
  const timezone = request.timezone ?? "America/New_York";
  const constraints: AppointmentLookupConstraints = {
    phone: request.phone,
    email: request.email,
    name: request.customerName,
    localDate: resolveDateHintLocal(request) ?? undefined,
  };
  if (!constraints.phone && !constraints.email) {
    return { status: "VERIFICATION_FAILED", reason: "missing_phone_or_email" };
  }
  const pool = loadStoreCandidates(request, timezone);
  const narrowed = narrowAppointmentCandidates(pool, constraints);
  const r = finalizeFromNarrowed(narrowed, 1, constraints);
  if (r.status === "FOUND") {
    return { ...r, needsConfirmation: false };
  }
  return r;
}

export function appointmentSelectionId(appointment: ExistingAppointment): string {
  return appointment.internalBookingId;
}

export function buildSingleAppointmentCandidateSet(
  appointment: ExistingAppointment,
): ExistingAppointmentCandidateSet {
  return {
    candidateSetId: `cand_set_${createId()}`,
    createdAt: new Date().toISOString(),
    candidates: [{ candidateId: "cand_1", appointment }],
  };
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
