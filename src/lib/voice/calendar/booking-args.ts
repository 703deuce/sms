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
