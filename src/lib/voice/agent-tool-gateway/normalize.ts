import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { normalizeBookingToolArgs } from "@/lib/voice/calendar/booking-args";
import type { CanonicalAvailabilityInput, CanonicalBookInput } from "./types";
import { AgentToolError } from "./errors";

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

export function normalizeBookInput(
  raw: Record<string, unknown>,
  ctx: { callId?: string },
): CanonicalBookInput {
  const n = normalizeBookingToolArgs(raw);
  const start_time = pickString(
    n.startsAt,
    n.start_time,
    n.startTime,
    n.startAt,
  );
  const customer_name = pickString(
    n.name,
    n.customerName,
    n.full_name,
    n.customer_name,
    [n.first_name, n.last_name].filter(Boolean).join(" "),
  );
  const customer_phone = pickString(n.phone, n.customerPhone, n.customer_phone);
  const customer_email = pickString(n.email, n.customerEmail, n.customer_email);
  const service_name = pickString(n.serviceName, n.service, n.service_name, "Appointment");
  const timezone = pickString(n.timezone, "America/New_York");
  const operation_id = pickString(
    n.operation_id,
    n.operationId,
    ctx.callId && start_time ? `${ctx.callId}-book-${start_time}` : "",
    ctx.callId ? `${ctx.callId}-book` : "",
  );

  return {
    operation_id,
    service_name,
    start_time,
    timezone,
    customer_name,
    customer_phone: customer_phone ? normalizeE164(customer_phone) : "",
    customer_email,
    contact_id: n.contactId ? String(n.contactId) : null,
    address: pickString(n.address, n.location) || null,
  };
}

export function validateBookInput(input: CanonicalBookInput): void {
  if (!input.operation_id) {
    throw new AgentToolError("INVALID_INPUT", "operation_id could not be determined");
  }
  if (!input.start_time) {
    throw new AgentToolError(
      "INVALID_INPUT",
      "start_time is required (ISO-8601 from check_availability slots)",
      false,
      "I need a specific appointment time from availability before I can book.",
    );
  }
  if (Number.isNaN(Date.parse(input.start_time))) {
    throw new AgentToolError("INVALID_INPUT", "start_time must be valid ISO-8601");
  }
  if (!input.service_name) {
    throw new AgentToolError("MISSING_REQUIRED_FIELD", "service_name is required");
  }
}

export function normalizeAvailabilityInput(
  raw: Record<string, unknown>,
): CanonicalAvailabilityInput {
  const n = normalizeBookingToolArgs(raw);
  return {
    service_name: pickString(n.serviceName, n.service, n.service_name, "Appointment"),
    start_time: pickString(n.startTime, n.from, n.startsAt, n.start_time) || null,
    end_time: pickString(n.endTime, n.to, n.end_time) || null,
    resolved_time: pickString(n.resolvedIso, n.resolved_time) || null,
    days_ahead:
      n.daysAhead != null && !Number.isNaN(Number(n.daysAhead))
        ? Number(n.daysAhead)
        : null,
    timezone: pickString(n.timezone) || null,
  };
}

export function validateAvailabilityInput(input: CanonicalAvailabilityInput): void {
  if (!input.service_name) {
    throw new AgentToolError("INVALID_INPUT", "service_name is required");
  }
}

/** Map canonical book input back to legacy booking.ts args. */
export function bookInputToLegacyArgs(
  input: CanonicalBookInput,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...extra,
    operationId: input.operation_id,
    serviceName: input.service_name,
    startsAt: input.start_time,
    timezone: input.timezone,
    name: input.customer_name,
    phone: input.customer_phone,
    email: input.customer_email,
    contactId: input.contact_id,
    address: input.address,
  };
}

/** Map canonical availability to legacy calendar_availability args. */
export function availabilityInputToLegacyArgs(
  input: CanonicalAvailabilityInput,
): Record<string, unknown> {
  const from = input.resolved_time || input.start_time;
  const to = input.end_time || input.resolved_time || input.start_time;
  return {
    serviceName: input.service_name,
    from,
    to,
    resolvedIso: input.resolved_time,
    daysAhead: input.days_ahead ?? undefined,
    timezone: input.timezone ?? undefined,
  };
}
