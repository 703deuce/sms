import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { buildMctbRequestFormPublicUrl } from "@/lib/mctb/request-form";

export type MctbTemplateVarContext = {
  config: MissedCallTextConfigRecord;
  callerE164: string;
  contact?: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  } | null;
  businessName?: string | null;
  missedCallEventId?: string | null;
};

const MCTB_RECOVERY_IDEMPOTENCY_PREFIX = "mctb-recovery:";

export function parseMctbRecoveryEventIdFromIdempotencyKey(
  idempotencyKey: string | null | undefined,
): string | null {
  if (!idempotencyKey) return null;
  const key = idempotencyKey.trim();
  if (!key.startsWith(MCTB_RECOVERY_IDEMPOTENCY_PREFIX)) return null;
  const eventId = key.slice(MCTB_RECOVERY_IDEMPOTENCY_PREFIX.length).trim();
  return eventId || null;
}

export function resolveMctbLinkDestinationUrl(
  config: Pick<MissedCallTextConfigRecord, "defaultLinkUrl" | "requestFormEnabled" | "requestFormToken">,
): string | null {
  if (config.requestFormEnabled && config.requestFormToken) {
    return buildMctbRequestFormPublicUrl(config.requestFormToken);
  }
  const url = config.defaultLinkUrl?.trim();
  return url || null;
}

export function resolveMctbTemplateVars(input: MctbTemplateVarContext): Record<string, string> {
  const firstName = input.contact?.firstName?.trim() || "there";
  const lastName = input.contact?.lastName?.trim() || "";
  const name = [input.contact?.firstName, input.contact?.lastName].filter(Boolean).join(" ") || "there";
  const linkUrl = resolveMctbLinkDestinationUrl(input.config) || "";
  const requestFormUrl =
    input.config.requestFormEnabled && input.config.requestFormToken
      ? buildMctbRequestFormPublicUrl(input.config.requestFormToken)
      : "";

  return {
    firstName,
    lastName,
    name,
    phone: input.callerE164,
    business_name: input.businessName?.trim() || "",
    businessName: input.businessName?.trim() || "",
    link: linkUrl,
    linkUrl,
    request_form_url: requestFormUrl,
    requestFormUrl,
    app_url: getAppBaseUrl(),
  };
}
