/** Resolve per-step copy + template variables for campaign messages. */

import { renderTemplate } from "@/lib/reputation/template-vars";
import type { SequenceStep } from "@/lib/reputation/sequence-engine";

export function buildCampaignTemplateVars(params: {
  firstName: string;
  lastName?: string | null;
  fullName?: string | null;
  businessName: string;
  reviewLink: string;
  serviceType?: string | null;
  locationName?: string | null;
  appointmentDate?: string | null;
  senderName?: string | null;
  unsubscribeLink?: string | null;
}): Record<string, string> {
  const first = params.firstName || "there";
  const reviewButton = params.reviewLink
    ? `Leave a review: ${params.reviewLink}`
    : "";
  const unsub =
    params.unsubscribeLink?.trim() ||
    "Unsubscribe: reply STOP for SMS or use the unsubscribe link in email.";
  return {
    first_name: first,
    last_name: (params.lastName ?? "").trim(),
    full_name: (params.fullName ?? first).trim() || first,
    customer_name: first,
    business_name: params.businessName || "us",
    review_link: params.reviewLink,
    review_button: reviewButton,
    service_type: params.serviceType?.trim() || "recent service",
    service_name: params.serviceType?.trim() || "recent service",
    appointment_date: params.appointmentDate?.trim() || "",
    location_name: params.locationName?.trim() || "",
    sender_name: params.senderName?.trim() || params.businessName || "us",
    unsubscribe_link: unsub,
  };
}

export function resolveStepMessageCopy(params: {
  step: SequenceStep;
  channel: "sms" | "email";
  fallbackSmsBody: string;
  fallbackEmailSubject: string;
  fallbackEmailBody: string;
  templateSubject?: string | null;
  templateBody?: string | null;
}): { subject: string | null; body: string } {
  const { step, channel } = params;
  if (channel === "sms") {
    const body = String(step.config.body ?? params.templateBody ?? params.fallbackSmsBody);
    return { subject: null, body };
  }
  const subject = String(
    step.config.subject ?? params.templateSubject ?? params.fallbackEmailSubject
  );
  const body = String(
    step.config.email_body ?? step.config.body ?? params.templateBody ?? params.fallbackEmailBody
  );
  return { subject, body };
}

export function renderStepMessage(params: {
  step: SequenceStep;
  channel: "sms" | "email";
  vars: Record<string, string>;
  fallbackSmsBody: string;
  fallbackEmailSubject: string;
  fallbackEmailBody: string;
  templateSubject?: string | null;
  templateBody?: string | null;
}): { subject: string | null; body: string } {
  const raw = resolveStepMessageCopy(params);
  return {
    subject: raw.subject != null ? renderTemplate(raw.subject, params.vars) : null,
    body: renderTemplate(raw.body, params.vars),
  };
}
