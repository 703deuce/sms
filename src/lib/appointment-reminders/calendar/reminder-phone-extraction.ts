/**
 * Reminder phone discovery from calendar events (import/sync only).
 * Deterministic parser first; Luna (gpt-6-luna) when missing or uncertain.
 */

import { createHash } from "node:crypto";
import { extractIdentityFromEventFields } from "@/lib/voice-v3/calendar/appointment-discovery-identity";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { ProviderCalendarEvent } from "@/lib/calendar/providers";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import {
  buildAppointmentEventSourceTexts,
  eventLocationText,
} from "@/lib/appointment-reminders/calendar/reminder-phone-content";
import type { LunaReminderPhoneResult } from "@/lib/appointment-reminders/calendar/reminder-phone-evidence";

export type ReminderPhoneDiscoveryStatus = "found" | "missing" | "needs_review" | "invalid";

export type ReminderPhoneExtraction = {
  e164: string | null;
  display: string | null;
  status: ReminderPhoneDiscoveryStatus;
  sourceField: string | null;
  method: "labeled_parse" | "single_candidate" | "luna" | "manual" | "contact" | "none";
  confidence: "high" | "medium" | "low";
  fingerprint: string;
  candidateCount: number;
  lunaAttemptedAt?: string | null;
  evidence?: string | null;
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
    location: eventLocationText(event),
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

/** Step 1 — deterministic parser only (no Luna). */
export function extractReminderPhoneFromCalendarEvent(
  event: ProviderCalendarEvent,
): ReminderPhoneExtraction {
  const fingerprint = reminderPhoneRelevantFingerprint(event);
  const subject = (event.summary || "").trim();
  const description = event.description || "";
  const location = eventLocationText(event);
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

export type LunaPhoneExtractFn = (
  event: ProviderCalendarEvent,
) => Promise<LunaReminderPhoneResult>;

async function defaultLunaExtract(event: ProviderCalendarEvent): Promise<LunaReminderPhoneResult> {
  const { lunaExtractCustomerPhoneFromCalendarEvent } = await import(
    "@/lib/appointment-reminders/calendar/reminder-phone-luna"
  );
  return lunaExtractCustomerPhoneFromCalendarEvent(event);
}

function parserNeedsLuna(parser: ReminderPhoneExtraction): boolean {
  return parser.status === "missing" || parser.status === "needs_review";
}

function toReminderPhoneMeta(extracted: ReminderPhoneExtraction): AppointmentMetadata["reminderPhone"] {
  return {
    e164: extracted.e164,
    status: extracted.status,
    sourceField: extracted.sourceField,
    method: extracted.method,
    confidence: extracted.confidence,
    fingerprint: extracted.fingerprint,
    candidateCount: extracted.candidateCount,
    extractedAt: new Date().toISOString(),
    lunaAttemptedAt: extracted.lunaAttemptedAt ?? undefined,
    evidence: extracted.evidence ?? undefined,
  };
}

export async function resolveReminderPhoneWithLunaFallback(
  event: ProviderCalendarEvent,
  options?: { lunaExtract?: LunaPhoneExtractFn },
): Promise<ReminderPhoneExtraction> {
  const parser = extractReminderPhoneFromCalendarEvent(event);
  if (!parserNeedsLuna(parser)) {
    return parser;
  }

  const lunaExtract = options?.lunaExtract ?? defaultLunaExtract;
  const attemptedAt = new Date().toISOString();
  const luna = await lunaExtract(event);

  if (luna.ok) {
    return {
      e164: luna.e164,
      display: luna.e164,
      status: "found",
      sourceField: luna.sourceField,
      method: "luna",
      confidence: "medium",
      fingerprint: parser.fingerprint,
      candidateCount: parser.candidateCount,
      lunaAttemptedAt: attemptedAt,
      evidence: luna.evidence,
    };
  }

  return {
    ...parser,
    lunaAttemptedAt: attemptedAt,
  };
}

export async function mergeReminderPhoneOnImport(
  input: {
    event: ProviderCalendarEvent;
    previousMetadata?: AppointmentMetadata | null;
    contactPhone: string | null;
  },
  options?: { lunaExtract?: LunaPhoneExtractFn },
): Promise<{
  inviteePhone: string | null;
  reminderPhone: AppointmentMetadata["reminderPhone"];
  smsCapable: boolean;
  emailOnly: boolean;
}> {
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

  const nextFp = reminderPhoneRelevantFingerprint(input.event);
  const prevFp = (prev.reminderPhone as { fingerprint?: string } | undefined)?.fingerprint;
  const prevLunaAttempted = Boolean(
    (prev.reminderPhone as { lunaAttemptedAt?: string } | undefined)?.lunaAttemptedAt,
  );

  if (prevFp && prevFp === nextFp) {
    const prevStatus = (prev.reminderPhone as { status?: string } | undefined)?.status;
    if (prev.inviteePhone?.trim() && prevStatus === "found") {
      return {
        inviteePhone: prev.inviteePhone.trim(),
        reminderPhone: prev.reminderPhone,
        smsCapable: Boolean(prev.inviteePhone),
        emailOnly: !prev.inviteePhone,
      };
    }
    if (prevLunaAttempted) {
      return {
        inviteePhone: prev.inviteePhone?.trim() || null,
        reminderPhone: prev.reminderPhone,
        smsCapable: Boolean(prev.inviteePhone) && prevStatus !== "needs_review",
        emailOnly: !prev.inviteePhone,
      };
    }
  }

  const extracted = await resolveReminderPhoneWithLunaFallback(input.event, options);
  const inviteePhone =
    input.contactPhone?.trim() ||
    (extracted.status === "found" ? extracted.e164 : null) ||
    prev.inviteePhone?.trim() ||
    null;

  const reminderPhone = toReminderPhoneMeta(extracted);

  return {
    inviteePhone,
    reminderPhone,
    smsCapable: Boolean(inviteePhone) && extracted.status !== "needs_review",
    emailOnly: !inviteePhone,
  };
}
