import type { MctbForwardingCarrier } from "./types";
import {
  type CarrierForwardingCapabilities,
  formatAttNoAnswerForwardDialCode,
  getCarrierCapabilities,
} from "./carrier-capabilities";

export type CarrierForwardingGuide = {
  id: MctbForwardingCarrier;
  label: string;
  steps: string[];
  supportUrl?: string;
  capabilities: CarrierForwardingCapabilities;
};

export const MCTB_CARRIER_GUIDES: CarrierForwardingGuide[] = [
  {
    id: "verizon",
    label: "Verizon",
    capabilities: getCarrierCapabilities("verizon"),
    steps: [
      "Set conditional forwarding (busy / no answer) to YOUR_TRANSOVO_NUMBER.",
      "If you use voicemail, set no-answer forward to ring fewer times than voicemail (recommended: ~15 seconds before forward).",
      "Dial *71 + YOUR_TRANSOVO_NUMBER + SEND to enable no-answer forwarding, or use My Verizon → Manage device → Call forwarding.",
      "Save and test by calling your business line from another phone without answering.",
    ],
    supportUrl: "https://www.verizon.com/support/call-forwarding-faqs/",
  },
  {
    id: "att",
    label: "AT&T",
    capabilities: getCarrierCapabilities("att"),
    steps: [
      "From your AT&T business iPhone, dial YOUR_ATT_NO_ANSWER_CODE then tap Call. (Live-verified: no-answer forward with timer — e.g. *61*15714073615*11*10# forwards after 10 seconds.)",
      "This sets no-answer forwarding to YOUR_TRANSOVO_NUMBER with a delay shorter than voicemail. Do not disable voicemail.",
      "Optional: disable iPhone Settings → Call Forwarding → When Unanswered if it conflicts — the dial code is the source of truth.",
      "Call your business line from another phone, don't answer, and use Test forwarding below.",
    ],
    supportUrl: "https://www.att.com/support/article/wireless/KM1008851/",
  },
  {
    id: "tmobile",
    label: "T-Mobile",
    capabilities: getCarrierCapabilities("tmobile"),
    steps: [
      "Set busy / no answer forwarding to YOUR_TRANSOVO_NUMBER (T-Mobile app or device settings).",
      "If voicemail is on, ensure no-answer forward rings fewer times than voicemail (recommended ~15 seconds).",
      "Test by calling your business line from another phone.",
    ],
    supportUrl: "https://www.t-mobile.com/support/plans-features/call-forwarding",
  },
  {
    id: "google_voice",
    label: "Google Voice",
    capabilities: getCarrierCapabilities("google_voice"),
    steps: [
      "Open voice.google.com → Settings → Calls.",
      "Enable call forwarding to YOUR_TRANSOVO_NUMBER when you don't answer.",
      "Set ring duration before forward (~15 seconds recommended).",
      "Test with a call to your Google Voice number.",
    ],
    supportUrl: "https://support.google.com/voice/answer/115106",
  },
  {
    id: "ringcentral",
    label: "RingCentral",
    capabilities: getCarrierCapabilities("ringcentral"),
    steps: [
      "Admin portal → Phone System → Call Handling & Forwarding.",
      "Forward unanswered calls to YOUR_TRANSOVO_NUMBER after ~15 seconds.",
      "Ensure voicemail does not answer before the forward rule.",
      "Save and test.",
    ],
    supportUrl: "https://support.ringcentral.com/article-v2/Setting-up-call-forwarding.html",
  },
  {
    id: "spectrum",
    label: "Spectrum",
    capabilities: getCarrierCapabilities("spectrum"),
    steps: [
      "Contact Spectrum or use account tools for conditional call forwarding (no answer / busy).",
      "Forward to YOUR_TRANSOVO_NUMBER with a shorter ring timer than voicemail (~15 seconds).",
      "Test by calling your business line.",
    ],
  },
  {
    id: "comcast",
    label: "Comcast / Xfinity",
    capabilities: getCarrierCapabilities("comcast"),
    steps: [
      "Xfinity Voice or device settings → forward on no answer to YOUR_TRANSOVO_NUMBER.",
      "Set forward to trigger before voicemail (~15 seconds recommended).",
      "Test with a call to your business line.",
    ],
  },
  {
    id: "other",
    label: "Other",
    capabilities: getCarrierCapabilities("other"),
    steps: [
      "Ask your provider for conditional call forwarding (no answer / busy) to YOUR_TRANSOVO_NUMBER.",
      "Request a no-answer timer shorter than voicemail pickup (~15 seconds).",
      "Use Test forwarding below to confirm the call reaches Transovo.",
    ],
  },
];

export function getCarrierGuide(carrier: MctbForwardingCarrier): CarrierForwardingGuide {
  return MCTB_CARRIER_GUIDES.find((g) => g.id === carrier) || MCTB_CARRIER_GUIDES.at(-1)!;
}

/** Replace dial-code placeholders for onboarding display. */
export function formatCarrierStep(
  step: string,
  input: { transovoE164: string; forwardRingSeconds?: number },
): string {
  const digits = input.transovoE164.replace(/\D/g, "");
  const national = digits.length === 10 ? `1${digits}` : digits;
  const seconds = String(input.forwardRingSeconds ?? 10);
  const attCode = formatAttNoAnswerForwardDialCode({
    forwardToE164: input.transovoE164,
    delaySeconds: input.forwardRingSeconds ?? 10,
  });
  return step
    .replace(/YOUR_TRANSOVO_NUMBER_DIGITS/g, national)
    .replace(/YOUR_FORWARD_RING_SECONDS/g, seconds)
    .replace(/YOUR_ATT_NO_ANSWER_CODE/g, attCode)
    .replace(/YOUR_TRANSOVO_NUMBER/g, input.transovoE164);
}

export { getCarrierCapabilities, DEFAULT_FORWARD_RING_SECONDS, formatAttNoAnswerForwardDialCode } from "./carrier-capabilities";
