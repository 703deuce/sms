/**
 * Normalize Telnyx / wizard / Calendly booking tool args into one shape.
 * Schemas historically use startAt/customerPhone while handlers used startsAt/phone.
 */
export function normalizeBookingToolArgs(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...args };

  const startsAt =
    args.startsAt || args.startAt || args.startTime || args.from || null;
  if (startsAt) out.startsAt = String(startsAt);

  const phone = args.phone || args.customerPhone || args.caller_phone || null;
  if (phone) out.phone = String(phone);

  const name =
    args.name || args.customerName || args.full_name || args.caller_name || null;
  if (name) out.name = String(name);

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
 *
 * When the caller wants "next Tuesday", the model should pass ISO for that day.
 * If it only passes daysAhead, keep enough runway to reach next week (7 days)
 * while still capping extreme scans.
 */
export function resolveAvailabilityTimeWindow(
  args: Record<string, unknown>,
  opts?: { maxDays?: number; now?: Date },
): AvailabilityTimeWindow {
  const maxDays = Math.max(1, Math.min(14, opts?.maxDays ?? 7));
  const now = opts?.now ? new Date(opts.now) : new Date();
  const rawStart = String(args.startTime || args.from || "").trim();
  const rawEnd = String(args.endTime || args.to || "").trim();
  const requestedDays = Number(args.daysAhead || 0);

  const startIsIso = rawStart ? isIsoDateTime(rawStart) : false;
  const endIsIso = rawEnd ? isIsoDateTime(rawEnd) : false;
  const startClock = rawStart && !startIsIso ? parseClockToMinutes(rawStart) : null;
  const endClock = rawEnd && !endIsIso ? parseClockToMinutes(rawEnd) : null;

  if (startIsIso && endIsIso) {
    const start = new Date(rawStart);
    const end = new Date(rawEnd);
    const spanDays = Math.max(
      1,
      Math.ceil(Math.abs(end.getTime() - start.getTime()) / 86_400_000),
    );
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      daysAhead: Math.min(Math.max(spanDays, 1), maxDays),
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

  // Default / clock-only: always cover at least a week when allowed so
  // "next Tuesday" works even if the model passes daysAhead:3.
  const floor = Math.min(7, maxDays);
  const days = Math.min(
    maxDays,
    requestedDays > 0 ? Math.max(requestedDays, floor) : floor,
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

/** Speakable slot labels so the model offers real times instead of UTC ISO. */
export function formatAvailabilitySlotsForAgent(
  slots: Array<{ startsAt: string; endsAt?: string }>,
  timeZone = "America/New_York",
): Array<{ startsAt: string; endsAt?: string; label: string }> {
  return slots.map((s) => {
    const start = new Date(s.startsAt);
    let label = s.startsAt;
    if (!Number.isNaN(start.getTime())) {
      try {
        label = new Intl.DateTimeFormat("en-US", {
          timeZone,
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZoneName: "short",
        }).format(start);
      } catch {
        label = start.toISOString();
      }
    }
    return {
      startsAt: s.startsAt,
      ...(s.endsAt ? { endsAt: s.endsAt } : {}),
      label,
    };
  });
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
