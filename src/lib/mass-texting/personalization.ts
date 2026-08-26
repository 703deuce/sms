import { estimateSmsSegments } from "@/lib/utils";
import { mergeTemplate, splitDisplayName } from "@/lib/messaging/template";
import { creditsForRenderedMessage } from "@/lib/mass-texting/pricing";

export const MASS_TEXT_MERGE_FIELDS = [
  "first_name",
  "last_name",
  "name",
  "business_name",
  "phone",
  "email",
  "tracking_link",
  "review_link",
  "booking_link",
  "payment_link",
  "offer",
  "appointment_date",
  "appointment_time",
] as const;

export type MassTextMergeVars = Record<string, string | null | undefined>;

export function massTextMergeVarsFromContact(input: {
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  businessName?: string | null;
  customFields?: Record<string, unknown> | null;
}): MassTextMergeVars {
  const names = splitDisplayName(
    input.displayName || [input.firstName, input.lastName].filter(Boolean).join(" "),
  );
  const vars: MassTextMergeVars = {
    first_name: input.firstName || names.first_name || "",
    last_name: input.lastName || names.last_name || "",
    name: names.name || input.firstName || "",
    customer_name: names.name || input.firstName || "",
    business_name: input.businessName || "",
    phone: input.phone || "",
    email: input.email || "",
  };
  if (input.customFields) {
    for (const [key, value] of Object.entries(input.customFields)) {
      if (value == null) continue;
      vars[key] = String(value);
    }
  }
  return vars;
}

export function renderMassTextBody(
  template: string,
  vars: MassTextMergeVars,
): { body: string; unresolved: string[] } {
  const unresolved: string[] = [];
  let body = mergeTemplate(template, vars);
  body = body.replace(/\{\{\s*[^}]+\s*\}\}/g, (match) => {
    unresolved.push(match);
    return "";
  });
  return { body: body.replace(/[ \t]{2,}/g, " ").trim(), unresolved };
}

export function creditsForRecipientBody(input: {
  template: string;
  vars: MassTextMergeVars;
  isMms: boolean;
}): { credits: number; segments: number; body: string; unresolved: string[] } {
  const rendered = renderMassTextBody(input.template, input.vars);
  const segments = Math.max(1, estimateSmsSegments(rendered.body).segments || 1);
  return {
    credits: creditsForRenderedMessage({ isMms: input.isMms, smsSegments: segments }),
    segments,
    body: rendered.body,
    unresolved: rendered.unresolved,
  };
}
