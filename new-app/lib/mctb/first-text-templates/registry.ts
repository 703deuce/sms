import type { MctbFirstTextTemplateDefinition, MctbFirstTextTemplateId } from "./types";

export const MCTB_FIRST_TEXT_TEMPLATE_REGISTRY: Record<
  MctbFirstTextTemplateId,
  MctbFirstTextTemplateDefinition
> = {
  on_a_job: {
    id: "on_a_job",
    name: "On a Job",
    purpose: "Believable missed-call reason, callback expectation, invite context while waiting.",
    body:
      "Hi, this is {{business_name}}. Sorry we missed you — we're on a job right now. We'll call you back {{callback_time}}. Reply with {{information_request_phrase}} so we have everything when we call.",
    bodyAfterHours:
      "Hi, this is {{business_name}}. Sorry we missed your call. We're closed right now, but we'll call you {{callback_time}}. Reply with {{information_request_phrase}} so we have everything when we call.",
    requiredVariables: ["business_name", "callbackTime"],
    usesCallbackTime: true,
  },
  quick_question: {
    id: "quick_question",
    name: "Quick Question",
    purpose: "Human tone with an easy question callers can answer in one reply.",
    body:
      "Hi, this is {{business_name}}. Sorry we missed you — we're helping another customer right now. Were you calling about {{service_1}} or {{service_2}}? You can reply here.",
    bodyAfterHours:
      "Hi, this is {{business_name}}. Sorry we missed your call — we're closed right now. Were you calling about {{service_1}} or {{service_2}}? Reply here.",
    requiredVariables: ["business_name", "service1", "service2"],
    usesCallbackTime: false,
  },
  callback_time: {
    id: "callback_time",
    name: "Callback Time",
    purpose: "Clear promise the business will call back soon; urgent callers can add context.",
    body:
      "Hi, this is {{business_name}}. Sorry we missed your call. We'll call you back {{callback_time}}. Reply with {{information_request_phrase}} so we have everything when we call.",
    bodyAfterHours:
      "Hi, this is {{business_name}}. Sorry we missed your call. We're closed for the evening, but we'll call you {{callback_time}}. Reply with {{information_request_phrase}} so we have everything when we call.",
    requiredVariables: ["business_name", "callbackTime"],
    usesCallbackTime: true,
  },
  what_do_you_need: {
    id: "what_do_you_need",
    name: "What Do You Need?",
    purpose: "Short opener to capture the reason for the call before callback.",
    body:
      "Hi, this is {{business_name}}. Sorry we missed you. Reply with {{information_request_phrase}} and we'll see it before we call you back.",
    bodyAfterHours:
      "Hi, this is {{business_name}}. Sorry we missed your call. We're closed right now. Reply with {{information_request_phrase}} and we'll call you when we reopen.",
    requiredVariables: ["business_name"],
    usesCallbackTime: false,
  },
  simple: {
    id: "simple",
    name: "Simple",
    purpose: "Universal fallback without claiming to be on a job or with another customer.",
    body:
      "Hi, this is {{business_name}}. Sorry we missed your call. Reply with {{information_request_phrase}} and we'll get back to you as soon as possible.",
    bodyAfterHours:
      "Hi, this is {{business_name}}. Sorry we missed your call. We're closed right now. Reply with {{information_request_phrase}} and we'll get back to you when we reopen.",
    requiredVariables: ["business_name"],
    usesCallbackTime: false,
  },
};

export const MCTB_FIRST_TEXT_TEMPLATE_ORDER: MctbFirstTextTemplateId[] = [
  "on_a_job",
  "quick_question",
  "callback_time",
  "what_do_you_need",
  "simple",
];

export function getMctbFirstTextTemplate(
  id: MctbFirstTextTemplateId,
): MctbFirstTextTemplateDefinition {
  return MCTB_FIRST_TEXT_TEMPLATE_REGISTRY[id];
}

/** Map legacy platform recovery template ids to first-text templates. */
export function migrateLegacyPlatformRecoveryTemplateId(
  raw: string | null | undefined,
): MctbFirstTextTemplateId {
  const id = String(raw || "").trim();
  const legacy: Record<string, MctbFirstTextTemplateId> = {
    recovery_opener: "simple",
    recovery_opener_concise: "what_do_you_need",
    recovery_opener_invite: "simple",
  };
  if (legacy[id]) return legacy[id];
  if (id in MCTB_FIRST_TEXT_TEMPLATE_REGISTRY) return id as MctbFirstTextTemplateId;
  return "simple";
}
