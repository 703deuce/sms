/**
 * Deterministic reminder phone discovery from calendar events (import/sync only).
 * AI disambiguation is reserved for ambiguous multi-number cases — not implemented in v1;
 * those rows are marked needs_review instead of guessing.
 */

import { createHash } from "node:crypto";
import { extractIdentityFromEventFields } from "@/lib/voice-v3/calendar/appointment-discovery-identity";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { ProviderCalendarEvent } from "@/lib/calendar/providers";
import type { AppointmentMetadata } from "@/lib/appointments/types";

export type ReminderPhoneDiscoveryStatus = "found" | "missing" | "needs_review" | "invalid";

export type ReminderPhoneExtraction = {
  e164: string | null;
  display: string | null;
  status: ReminderPhoneDiscoveryStatus;
  sourceField: string | null;
  method: "labeled_parse" | "single_candidate" | "manual" | "contact" | "none";
  confidence: "high" | "medium" | "low";
  fingerprint: string;
  candidateCount: number;
};

const CUSTOMER_LABEL_RE =
  /(?:customer|client|patient|mobile|cell|sms|text)\s*(?:phone|#|number|no\.?)?\s*[:.\-]?\s*([+\d().\s\-]{10,})/gi;
const OFFICE_LABEL_RE =
  /(?:office|business|main|fax|front\s*desk)\s*(?:phone|#|number|no\.?)?\s*[:.\-]?\s*([+\d().\s\-]{10,})/gi;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function reminderPhoneRelevantFingerprint(event: ProviderCalendarEvent): string {
  const payload = JSON.stringify({
    summary: event.summary || "",
    description: event.description || "",
    location: event.location || "",
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function tryNormalize(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const e164 = normalizeE164(trimmed);
    return e164 || null;
  } catch {
    return null;
  }
}

function labeledNumbers(plain: string): { customer: string[]; office: string[] } {
  const customer: string[] = [];
  const office: string[] = [];
  for (const m of plain.matchAll(CUSTOMER_LABEL_RE)) {
    if (m[1]) customer.push(m[1]);
  }
  for (const m of plain.matchAll(OFFICE_LABEL_RE)) {
    if (m[1]) office.push(m[1]);
  }
  return { customer, office };
}

export function extractReminderPhoneFromCalendarEvent(
  event: ProviderCalendarEvent,
): ReminderPhoneExtraction {
  const fingerprint = reminderPhoneRelevantFingerprint(event);
  const subject = (event.summary || "").trim();
  const description = event.description || "";
  const location = (event.location || "").trim();
  const plain = stripHtml(`${subject}\n${description}\n${location}`);

  const identity = extractIdentityFromEventFields({
    subject,
    description,
    location,
    attendeeNames: event.attendees?.map((a) => a.name).filter(Boolean) as string[],
    attendeeEmails: event.attendees?.map((a) => a.email).filter(Boolean) as string[],
  });

  const labeled = labeledNumbers(plain);
  const customerNormalized = [...new Set(labeled.customer.map(tryNormalize).filter(Boolean))] as string[];
  const officeNormalized = new Set(labeled.office.map(tryNormalize).filter(Boolean));

  if (customerNormalized.length === 1) {
    return {
      e164: customerNormalized[0]!,
      display: customerNormalized[0]!,
      status: "found",
      sourceField: "description",
      method: "labeled_parse",
      confidence: "high",
      fingerprint,
      candidateCount: identity.phones.length,
    };
  }

  if (customerNormalized.length > 1) {
    return {
      e164: null,
      display: null,
      status: "needs_review",
      sourceField: "description",
      method: "labeled_parse",
      confidence: "low",
      fingerprint,
      candidateCount: customerNormalized.length,
    };
  }

  const allCandidates = identity.phones
    .map((digits) => tryNormalize(digits.length === 10 ? `+1${digits}` : `+${digits}`))
    .filter(Boolean) as string[];

  const unique = [...new Set(allCandidates)].filter((p) => !officeNormalized.has(p));

  if (unique.length === 1) {
    return {
      e164: unique[0]!,
      display: unique[0]!,
      status: "found",
      sourceField: subject.match(/\d{10}/) ? "title" : "description",
      method: "single_candidate",
      confidence: "medium",
      fingerprint,
      candidateCount: allCandidates.length,
    };
  }

  if (unique.length > 1) {
    return {
      e164: null,
      display: null,
      status: "needs_review",
      sourceField: "description",
      method: "single_candidate",
      confidence: "low",
      fingerprint,
      candidateCount: unique.length,
    };
  }

  return {
    e164: null,
    display: null,
    status: "missing",
    sourceField: null,
    method: "none",
    confidence: "low",
    fingerprint,
    candidateCount: 0,
  };
}

export function mergeReminderPhoneOnImport(input: {
  event: ProviderCalendarEvent;
  previousMetadata?: AppointmentMetadata | null;
  contactPhone: string | null;
}): {
  inviteePhone: string | null;
  reminderPhone: AppointmentMetadata["reminderPhone"];
  smsCapable: boolean;
  emailOnly: boolean;
} {
  const prev = input.previousMetadata || {};
  const userLocked = Boolean(prev.reminderPhoneUserLocked || prev.reminderOverride?.phone?.trim());

  if (userLocked) {
    const phone =
      prev.reminderOverride?.phone?.trim() ||
      prev.inviteePhone?.trim() ||
      input.contactPhone ||
      null;
    return {
      inviteePhone: phone,
      reminderPhone: prev.reminderPhone,
      smsCapable: Boolean(phone),
      emailOnly: !phone,
    };
  }

  const prevFp = (prev.reminderPhone as { fingerprint?: string } | undefined)?.fingerprint;
  const nextFp = reminderPhoneRelevantFingerprint(input.event);
  if (prevFp && prevFp === nextFp && prev.inviteePhone?.trim()) {
    return {
      inviteePhone: prev.inviteePhone.trim(),
      reminderPhone: prev.reminderPhone,
      smsCapable: Boolean(prev.inviteePhone),
      emailOnly: !prev.inviteePhone,
    };
  }

  const extracted = extractReminderPhoneFromCalendarEvent(input.event);
  const inviteePhone =
    input.contactPhone?.trim() ||
    (extracted.status === "found" ? extracted.e164 : null) ||
    prev.inviteePhone?.trim() ||
    null;

  const reminderPhone = {
    e164: extracted.e164,
    status: extracted.status,
    sourceField: extracted.sourceField,
    method: extracted.method,
    confidence: extracted.confidence,
    fingerprint: extracted.fingerprint,
    candidateCount: extracted.candidateCount,
    extractedAt: new Date().toISOString(),
  };

  return {
    inviteePhone,
    reminderPhone,
    smsCapable: Boolean(inviteePhone) && extracted.status !== "needs_review",
    emailOnly: !inviteePhone,
  };
}
