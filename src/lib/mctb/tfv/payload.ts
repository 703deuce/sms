import type { MessagingRegistration } from "@/lib/domain";
import type { MctbConsentMode } from "@/lib/mctb/onboarding/types";

const PRESS_1_USE_CASE =
  "When a consumer calls the business and the call is not answered, the call may forward to a toll-free number where the caller hears a brief SMS disclosure and may press 1 to consent to one immediate missed-call follow-up text. No additional automated messages are sent unless the consumer replies.";

const EXISTING_CONSENT_USE_CASE =
  "When a consumer calls the business and the call is not answered, the business may send one immediate SMS acknowledging the missed call to callers for whom the business has already obtained valid prior express consent. No additional automated messages are sent unless the consumer replies.";

export function buildTfvSubmissionPayload(input: {
  reg: MessagingRegistration;
  businessName: string;
  businessWebsite: string;
  notificationEmail: string;
  messageTemplate: string;
  consentMode: MctbConsentMode | null | undefined;
  tollfreePhoneNumberSid: string;
  externalReferenceId: string;
}): {
  useCaseSummary: string;
  productionMessageSample: string;
  optInType: "VERBAL" | "WEB_FORM";
  optInImageUrls: string[];
  additionalInformation: string;
  messageVolume: string;
} {
  const mode = input.consentMode || "press_1";

  if (mode === "existing_consent") {
    return {
      useCaseSummary: input.reg.useCaseDescription || EXISTING_CONSENT_USE_CASE,
      productionMessageSample: input.messageTemplate || EXISTING_CONSENT_USE_CASE,
      optInType: "WEB_FORM",
      optInImageUrls: input.reg.optInFormUrl ? [input.reg.optInFormUrl] : [],
      additionalInformation:
        "Business attests that callers have provided prior express written consent for missed-call follow-up SMS via web form, written agreement, or established business relationship. Consent records are maintained by the business.",
      messageVolume: input.reg.messageVolume || "100",
    };
  }

  return {
    useCaseSummary: input.reg.useCaseDescription || PRESS_1_USE_CASE,
    productionMessageSample: input.messageTemplate || PRESS_1_USE_CASE,
    optInType: "VERBAL",
    optInImageUrls: input.reg.optInFormUrl ? [input.reg.optInFormUrl] : [],
    additionalInformation:
      "During the forwarded missed call, the caller hears an SMS disclosure and must press 1 to consent before any missed-call follow-up text is sent.",
    messageVolume: input.reg.messageVolume || "100",
  };
}
