import type { MctbForwardingCarrier } from "./types";

export type CarrierForwardingGuide = {
  id: MctbForwardingCarrier;
  label: string;
  steps: string[];
  supportUrl?: string;
};

export const MCTB_CARRIER_GUIDES: CarrierForwardingGuide[] = [
  {
    id: "verizon",
    label: "Verizon",
    steps: [
      "Open the My Verizon app or dial *72 from your business phone.",
      "Enter your Transovo forwarding number when prompted.",
      "Choose conditional forwarding (forward when busy / no answer).",
      "Save and test by calling your business line without answering.",
    ],
    supportUrl: "https://www.verizon.com/support/call-forwarding-faqs/",
  },
  {
    id: "att",
    label: "AT&T",
    steps: [
      "Sign in to your AT&T account or use your phone's call settings.",
      "Find Call Forwarding or Conditional Call Forwarding.",
      "Set forward on no answer / busy to your Transovo number.",
      "Save changes and run a test call.",
    ],
    supportUrl: "https://www.att.com/support/article/wireless/KM1008851/",
  },
  {
    id: "tmobile",
    label: "T-Mobile",
    steps: [
      "Open T-Mobile app or dial **21*YOUR_TRANSOVO_NUMBER# for unconditional forwarding.",
      "For conditional forwarding, use your device call settings or contact T-Mobile.",
      "Set busy / no answer to your Transovo number.",
      "Test by calling your business line.",
    ],
    supportUrl: "https://www.t-mobile.com/support/plans-features/call-forwarding",
  },
  {
    id: "google_voice",
    label: "Google Voice",
    steps: [
      "Open voice.google.com and go to Settings.",
      "Under Calls, enable call forwarding to your Transovo number.",
      "Set to forward when you don't answer.",
      "Test with a call to your Google Voice number.",
    ],
    supportUrl: "https://support.google.com/voice/answer/115106",
  },
  {
    id: "ringcentral",
    label: "RingCentral",
    steps: [
      "Sign in to the RingCentral admin portal.",
      "Go to Phone System → Call Handling & Forwarding.",
      "Add your Transovo number as a forward destination for unanswered calls.",
      "Save and test.",
    ],
    supportUrl: "https://support.ringcentral.com/article-v2/Setting-up-call-forwarding.html",
  },
  {
    id: "spectrum",
    label: "Spectrum",
    steps: [
      "Sign in to your Spectrum account or use your phone dial codes.",
      "Enable conditional call forwarding (no answer / busy).",
      "Enter your Transovo number as the forward destination.",
      "Test by calling your business line.",
    ],
  },
  {
    id: "comcast",
    label: "Comcast / Xfinity",
    steps: [
      "Sign in to Xfinity Voice or use your phone's call forwarding settings.",
      "Set up forward on no answer to your Transovo number.",
      "Save settings.",
      "Test with a call to your business line.",
    ],
  },
  {
    id: "other",
    label: "Other",
    steps: [
      "Contact your phone provider and ask for conditional call forwarding.",
      "Request: forward to your Transovo number when busy or not answered.",
      "Some carriers call this 'no answer/busy transfer' or 'conditional forwarding'.",
      "Once configured, use Test my connection below.",
    ],
  },
];

export function getCarrierGuide(carrier: MctbForwardingCarrier): CarrierForwardingGuide {
  return MCTB_CARRIER_GUIDES.find((g) => g.id === carrier) || MCTB_CARRIER_GUIDES.at(-1)!;
}
