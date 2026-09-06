/**
 * Normalize Telnyx / wizard / Calendly booking tool args into one shape.
 * Schemas historically use startAt/customerPhone while handlers used startsAt/phone.
 */
export function normalizeBookingToolArgs(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };

  // resolve_datetime returns resolvedIso — models often pass it straight to availability.
  const resolvedIso = args.resolvedIso || args.resolved_iso || null;
  if (resolvedIso && !args.from && !args.startTime && !args.startsAt) {
    out.from = String(resolvedIso);
    if (!args.to && !args.endTime) {
      out.to = String(resolvedIso);
    }
  }

  const startsAt =
    args.startsAt ||
    args.startAt ||
    args.startTime ||
    args.from ||
    resolvedIso ||
    null;
  if (startsAt) out.startsAt = String(startsAt);

  const phone = args.phone || args.customerPhone || args.caller_phone || null;
  if (phone) out.phone = String(phone);

  const name =
    args.name ||
    args.customerName ||
    args.full_name ||
    args.caller_name ||
    args.inviteeName ||
    [args.firstName, args.lastName].filter(Boolean).join(" ").trim() ||
    null;
  if (name) {
    out.name = String(name);
    if (!out.full_name) out.full_name = String(name);
  }

  const email = args.email || args.customerEmail || null;
  if (email) out.email = String(email);

  const serviceName =
    args.serviceName ||
    args.service ||
    args.appointmentType ||
    (typeof args.serviceId === "string" && !args.serviceId.startsWith("svc_")
      ? args.serviceId
      : null);
  if (serviceName) {
    out.serviceName = String(serviceName);
    out.service = String(serviceName);
  }

  if (args.to && !out.endTime) out.endTime = args.to;
  if (args.from && !out.startTime) out.startTime = args.from;
  // Point-in-time slot checks: startsAt without explicit window bounds.
  if (out.startsAt && !out.startTime && !out.from) {
    out.startTime = out.startsAt;
    if (!out.endTime && !out.to) {
      out.endTime = out.startsAt;
    }
  }

  return out;
}

const CLOCK_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function isIsoDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function parseClockToMinutes(value: string): number | null {
  const m = CLOCK_RE.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

export type AvailabilityTimeWindow = {
  /** ISO start of search window */
  startTime: string;
  /** ISO end of search window */
  endTime: string;
  /** Days spanned (1–7), for internal slot generators */
  daysAhead: number;
  /** Optional morning/afternoon filter in minutes from midnight */
  preferredStartMinute: number | null;
  preferredEndMinute: number | null;
};

/**
 * Voice models often pass wall-clock times ("08:00") with daysAhead instead of
 * ISO datetimes. Calendly requires ISO — convert before calling providers.
 * Caps the window so mid-call webhooks stay under Telnyx tool timeouts (~5–10s).
 */
export function resolveAvailabilityTimeWindow(
  args: Record<string, unknown>,
  opts?: { maxDays?: number; now?: Date },
): AvailabilityTimeWindow {
  const maxDays = Math.max(1, Math.min(14, opts?.maxDays ?? 3));
  const now = opts?.now ? new Date(opts.now) : new Date();
  const rawStart = String(
    args.startTime || args.from || args.startsAt || args.startAt || args.resolvedIso || "",
  ).trim();
  const rawEnd = String(
    args.endTime || args.to || args.startsAt || args.startAt || args.resolvedIso || "",
  ).trim();
  const requestedDays = Number(args.daysAhead || 0);

  const startIsIso = rawStart ? isIsoDateTime(rawStart) : false;
  const endIsIso = rawEnd ? isIsoDateTime(rawEnd) : false;
  const startClock = rawStart && !startIsIso ? parseClockToMinutes(rawStart) : null;
  const endClock = rawEnd && !endIsIso ? parseClockToMinutes(rawEnd) : null;

  if (startIsIso && endIsIso) {
    const start = new Date(rawStart);
    let end = new Date(rawEnd);
    // Voice tools often pass from=to=resolved slot (point-in-time). Calendly requires end > start.
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 86_400_000);
    }
    // Inclusive calendar-day span (same morning window = 1 day, not "from tonight").
    const spanMs = Math.max(0, end.getTime() - start.getTime());
    const spanDays = Math.max(1, Math.ceil(spanMs / 86_400_000) || 1);
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      // Keep the real window dates; daysAhead is only a scan budget hint.
      daysAhead: Math.min(Math.max(spanDays, requestedDays > 0 ? requestedDays : spanDays), maxDays),
      preferredStartMinute: null,
      preferredEndMinute: null,
    };
  }

  if (startIsIso && !endIsIso) {
    const start = new Date(rawStart);
    const days = Math.min(maxDays, requestedDays > 0 ? requestedDays : 1);
    const end = new Date(start.getTime() + days * 86_400_000);
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      daysAhead: days,
      preferredStartMinute: endClock,
      preferredEndMinute: endClock,
    };
  }

  const days = Math.min(
    maxDays,
    requestedDays > 0 ? requestedDays : maxDays,
  );
  const start = new Date(now.getTime() + 30 * 60_000);
  const end = new Date(start.getTime() + days * 86_400_000);
  return {
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    daysAhead: days,
    preferredStartMinute: startClock,
    preferredEndMinute: endClock,
  };
}

/** Map wizard requiredField ids onto normalized tool arg keys. */
const REQUIRED_FIELD_ALIASES: Record<string, string[]> = {
  full_name: ["name", "customerName", "full_name", "caller_name"],
  name: ["name", "customerName", "full_name", "caller_name"],
  phone: ["phone", "customerPhone", "caller_phone"],
  email: ["email", "customerEmail"],
  service: ["serviceName", "service", "appointmentType"],
  serviceName: ["serviceName", "service", "appointmentType"],
  address: ["address", "location"],
  location: ["location", "address"],
};

/** Params for Calendly appointment.list_available_times — single normalization path. */
export function buildCalendlyListAvailableTimesParams(
  args: Record<string, unknown>,
  opts?: { maxDays?: number; now?: Date },
): {
  eventTypeUri?: string;
  startTime: string;
  endTime: string;
  window: AvailabilityTimeWindow;
  normalized: Record<string, unknown>;
} {
  const normalized = normalizeBookingToolArgs(args);
  const window = resolveAvailabilityTimeWindow(normalized, opts);
  const eventTypeUri = normalized.eventTypeUri || normalized.eventTypeId;
  return {
    eventTypeUri: eventTypeUri ? String(eventTypeUri) : undefined,
    startTime: window.startTime,
    endTime: window.endTime,
    window,
    normalized,
  };
}

/** Params for Calendly appointment.book — single normalization path. */
export function buildCalendlyBookParams(args: Record<string, unknown>): {
  name: string;
  email: string;
  phone: string | null;
  startTime: string | undefined;
  timezone: string;
  eventTypeUri?: string;
  normalized: Record<string, unknown>;
} {
  const normalized = normalizeBookingToolArgs(args);
  const startTime = normalized.startsAt ? String(normalized.startsAt) : undefined;
  const eventTypeUri = normalized.eventTypeUri || normalized.eventTypeId;
  return {
    name: String(normalized.name || "Caller").trim(),
    email: String(normalized.email || "").trim(),
    phone: normalized.phone ? String(normalized.phone) : null,
    startTime,
    timezone: String(normalized.timezone || "America/New_York"),
    eventTypeUri: eventTypeUri ? String(eventTypeUri) : undefined,
    normalized,
  };
}

/**
 * Voice agents must book only slots returned by the latest calendar_availability on this call.
 * Rejects invented or converted times before Calendly returns a vague "invalid parameters" error.
 */
export function assertStartsAtMatchesAvailabilitySlots(
  startsAt: string,
  slots: string[],
): void {
  if (!slots.length) {
    throw new Error(
      "Call calendar_availability first, then pass startsAt copied exactly from slots[].startsAt.",
    );
  }
  const requested = new Date(startsAt).getTime();
  if (!Number.isFinite(requested)) {
    throw new Error(
      "startsAt must be a valid ISO datetime copied from calendar_availability.slots[].startsAt.",
    );
  }
  const match = slots.some(
    (s) => Math.abs(new Date(s).getTime() - requested) < 60_000,
  );
  if (!match) {
    const preview = slots.slice(0, 5).join(", ");
    throw new Error(
      `startsAt must be copied EXACTLY from the latest calendar_availability.slots[].startsAt — do not convert spoken times yourself. You passed ${startsAt}. Valid slots: ${preview}`,
    );
  }
}

export function fieldSatisfied(
  field: string,
  input: Record<string, unknown>,
): boolean {
  const key = field.trim();
  if (!key) return true;
  const aliases = REQUIRED_FIELD_ALIASES[key] || [
    key,
    key.toLowerCase(),
    ...Object.keys(REQUIRED_FIELD_ALIASES).filter((k) =>
      REQUIRED_FIELD_ALIASES[k].includes(key),
    ),
  ];
  for (const alias of aliases) {
    const val = input[alias];
    if (val != null && String(val).trim() !== "") return true;
  }
  return false;
}
