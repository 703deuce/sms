import type { ExistingAppointment } from "./appointment-management-types";
import type { AppointmentWhenConstraint } from "./appointment-lookup-when";
import { DEFAULT_SCHEDULING_POLICY } from "../time/scheduling-types";
import { parseHm } from "../time/timezone";
import {
  extractIdentityFromEventFields,
  nameAppearsInEvent,
  normalizeEmail,
  normalizePersonName,
  normalizePhoneDigits,
  phonesEquivalent,
  type ExtractedEventIdentity,
} from "./appointment-discovery-identity";

export type AppointmentDiscriminator =
  | "name"
  | "phone"
  | "email"
  | "appointment_date"
  | "appointment_time"
  | "service"
  | "location"
  | "candidate_selection";

export type AppointmentDiscoveryRecord = ExistingAppointment & {
  discovery: ExtractedEventIdentity;
  safeDisplay: string;
};

export type AppointmentLookupConstraints = {
  name?: string;
  phone?: string;
  email?: string;
  /** YYYY-MM-DD when known */
  localDate?: string;
  service?: string;
  location?: string;
  ani?: string;
  when?: AppointmentWhenConstraint | null;
};

export function buildSafeAppointmentDisplay(
  appointment: ExistingAppointment,
  discovery: ExtractedEventIdentity,
  timezone: string,
): string {
  const subject = discovery.subject?.trim();
  const timePart = appointment.localStart.slice(0, 16).replace("T", " ");
  if (subject) return `${timePart} — ${subject}`;
  return timePart;
}

export function eventRecordFromAppointment(
  appointment: ExistingAppointment,
  timezone: string,
): AppointmentDiscoveryRecord {
  const discovery = extractIdentityFromEventFields({
    subject: appointment.customerIdentity.name
      ? `${appointment.customerIdentity.name}`
      : undefined,
    description: [
      appointment.customerIdentity.email ? `Email: ${appointment.customerIdentity.email}` : null,
      appointment.customerIdentity.phone ? `Phone: ${appointment.customerIdentity.phone}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    attendeeEmails: appointment.customerIdentity.email
      ? [appointment.customerIdentity.email]
      : [],
    attendeeNames: appointment.customerIdentity.name ? [appointment.customerIdentity.name] : [],
  });
  return {
    ...appointment,
    discovery,
    safeDisplay: buildSafeAppointmentDisplay(appointment, discovery, timezone),
  };
}

function matchesDate(appointment: ExistingAppointment, localDate?: string): boolean {
  if (!localDate?.trim()) return true;
  const d = localDate.trim();
  return appointment.localStart.startsWith(d);
}

function matchesService(discovery: ExtractedEventIdentity, service?: string): boolean {
  if (!service?.trim()) return true;
  const q = service.trim().toLowerCase();
  if (discovery.subject.toLowerCase().includes(q)) return true;
  return discovery.serviceHints.some((h) => h.toLowerCase().includes(q));
}

function matchesLocation(discovery: ExtractedEventIdentity, location?: string): boolean {
  if (!location?.trim()) return true;
  const q = location.trim().toLowerCase();
  return discovery.location.toLowerCase().includes(q) || discovery.bodyText.toLowerCase().includes(q);
}

function matchesPhoneConstraint(record: AppointmentDiscoveryRecord, phone?: string, ani?: string): boolean {
  const targets = [phone, ani].filter(Boolean) as string[];
  if (targets.length === 0) return true;
  const eventPhones = [
    ...record.discovery.phones,
    ...(record.customerIdentity.phone ? [normalizePhoneDigits(record.customerIdentity.phone)] : []),
  ];
  return targets.some((t) => eventPhones.some((ep) => phonesEquivalent(t, ep)));
}

function matchesEmailConstraint(record: AppointmentDiscoveryRecord, email?: string): boolean {
  if (!email?.trim()) return true;
  const e = normalizeEmail(email);
  const eventEmails = [
    ...record.discovery.emails,
    ...(record.customerIdentity.email ? [normalizeEmail(record.customerIdentity.email)] : []),
  ];
  return eventEmails.includes(e);
}

function matchesNameConstraint(record: AppointmentDiscoveryRecord, name?: string): boolean {
  if (!name?.trim()) return true;
  const n = normalizePersonName(name);
  return nameAppearsInEvent(n, record.discovery);
}

function localHmFromAppointmentStart(localStart: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(localStart);
  return m ? `${m[1]}:${m[2]}` : "";
}

function daypartWindow(daypart: "MORNING" | "AFTERNOON" | "EVENING") {
  const policy = DEFAULT_SCHEDULING_POLICY;
  if (daypart === "MORNING") return policy.morning;
  if (daypart === "AFTERNOON") return policy.afternoon;
  return policy.evening;
}

function matchesAppointmentWhen(
  record: AppointmentDiscoveryRecord,
  when?: AppointmentWhenConstraint | null,
): boolean {
  if (!when) return true;
  const norm = when.normalized;
  if (norm?.localDate && !matchesDate(record, norm.localDate)) return false;

  if (when.localTimeHm) {
    return localHmFromAppointmentStart(record.localStart) === when.localTimeHm.trim();
  }

  if (when.daypartOnly) {
    const hm = localHmFromAppointmentStart(record.localStart);
    const parsed = parseHm(hm);
    const window = daypartWindow(when.daypartOnly);
    const start = parseHm(window.start);
    const end = parseHm(window.end);
    if (!parsed || !start || !end) return false;
    const mins = parsed.hour * 60 + parsed.minute;
    return mins >= start.hour * 60 + start.minute && mins < end.hour * 60 + end.minute;
  }

  if (norm?.precision === "EXACT_TIME" && norm.utcStart) {
    return record.startUtc === norm.utcStart;
  }
  if (
    (norm?.precision === "DAYPART" || norm?.precision === "RANGE") &&
    norm.utcStart &&
    norm.utcEnd
  ) {
    const t = new Date(record.startUtc).getTime();
    return t >= new Date(norm.utcStart).getTime() && t <= new Date(norm.utcEnd).getTime();
  }
  if (norm?.precision === "OPEN_RANGE" && norm.utcStart) {
    return new Date(record.startUtc).getTime() >= new Date(norm.utcStart).getTime();
  }
  if (norm?.precision === "DATE_ONLY" && norm.localDate) {
    return matchesDate(record, norm.localDate);
  }
  return true;
}

export function narrowAppointmentCandidates(
  candidates: AppointmentDiscoveryRecord[],
  constraints: AppointmentLookupConstraints,
): AppointmentDiscoveryRecord[] {
  return candidates.filter((c) => {
    if (!matchesDate(c, constraints.localDate)) return false;
    if (!matchesAppointmentWhen(c, constraints.when)) return false;
    if (!matchesNameConstraint(c, constraints.name)) return false;
    if (!matchesPhoneConstraint(c, constraints.phone, constraints.ani)) return false;
    if (!matchesEmailConstraint(c, constraints.email)) return false;
    if (!matchesService(c.discovery, constraints.service)) return false;
    if (!matchesLocation(c.discovery, constraints.location)) return false;
    return true;
  });
}

function distinctValues(values: string[]): boolean {
  const s = new Set(values.filter(Boolean));
  return s.size > 1;
}

export function computeUsefulDiscriminators(
  candidates: AppointmentDiscoveryRecord[],
  constraints?: AppointmentLookupConstraints,
): AppointmentDiscriminator[] {
  if (candidates.length <= 1) return [];

  const out: AppointmentDiscriminator[] = [];

  const phones = candidates.map((c) => {
    const p = c.discovery.phones[0] ?? c.customerIdentity.phone;
    return p ? normalizePhoneDigits(p) : "";
  });
  const phoneUseful = distinctValues(phones) && phones.some(Boolean);
  const aniAlreadyApplied = Boolean(constraints?.ani?.trim());
  if (phoneUseful && !(aniAlreadyApplied && !distinctValues(phones))) out.push("phone");

  const emails = candidates.map((c) => {
    const e = c.discovery.emails[0] ?? c.customerIdentity.email;
    return e ? normalizeEmail(e) : "";
  });
  if (distinctValues(emails) && emails.some(Boolean)) out.push("email");

  const dates = candidates.map((c) => c.localStart.slice(0, 10));
  if (distinctValues(dates)) out.push("appointment_date");

  const times = candidates.map((c) => c.localStart.slice(11, 16));
  if (distinctValues(times) && !distinctValues(dates)) out.push("appointment_time");

  const services = candidates.map((c) => c.discovery.serviceHints[0] ?? c.discovery.subject);
  if (distinctValues(services.map((s) => s.toLowerCase()))) out.push("service");

  const locations = candidates.map((c) => c.discovery.location);
  if (distinctValues(locations.map((l) => l.toLowerCase())) && locations.some(Boolean)) {
    out.push("location");
  }

  if (out.length === 0) out.push("candidate_selection");
  return out;
}

export function hasAnyLookupConstraint(constraints: AppointmentLookupConstraints): boolean {
  return Boolean(
    constraints.name?.trim() ||
      constraints.phone?.trim() ||
      constraints.email?.trim() ||
      constraints.localDate?.trim() ||
      constraints.service?.trim() ||
      constraints.location?.trim() ||
      constraints.ani?.trim() ||
      constraints.when,
  );
}
