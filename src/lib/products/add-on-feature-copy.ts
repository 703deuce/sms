import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";

export const ADD_ON_FEATURE_COPY: Record<
  TransovoProductFeature,
  { title: string; description: string; upgradeParam: string }
> = {
  mctb: {
    title: "Missed Call Text Back",
    description: "Recover missed calls with automated text-back.",
    upgradeParam: "mctb",
  },
  mass_texting: {
    title: "Mass Texting",
    description: "Upload contacts, send campaigns, and manage replies in one inbox.",
    upgradeParam: "mass_texting",
  },
  smart_routing: {
    title: "Smart Routing",
    description: "Route inbound calls to your team with menus and schedules.",
    upgradeParam: "smart_routing",
  },
  call_forwarding: {
    title: "Call Forwarding",
    description:
      "One business number that rings your existing phone — voicemail, business hours, and SMS callbacks.",
    upgradeParam: "call_forwarding",
  },
  visual_voicemail: {
    title: "Voicemail",
    description:
      "Included with Missed Call Text Back — recorded messages, transcripts, and AI summaries when callers reach voicemail.",
    upgradeParam: "mctb",
  },
  callback_requests: {
    title: "Callback Requests",
    description:
      "Queue callers who asked to be contacted later from your menu or overflow routes.",
    upgradeParam: "callback_requests",
  },
  ai_transcription: {
    title: "Transcription",
    description:
      "Included with Missed Call Text Back voicemail capture — readable transcripts and AI summaries.",
    upgradeParam: "mctb",
  },
  fax: {
    title: "Fax",
    description: "Send and receive faxes online with searchable AI document intelligence.",
    upgradeParam: "fax",
  },
  verify: {
    title: "Verify",
    description: "Verify phone numbers and clean CSV lists with carrier and line-type lookup.",
    upgradeParam: "verify",
  },
  transovo_video: {
    title: "Transovo Video",
    description: "Host branded video meetings linked to appointments and team scheduling.",
    upgradeParam: "transovo_video",
  },
  ai_notetaker: {
    title: "AI Notetaker",
    description: "Capture meeting notes, action items, and recaps from your calls.",
    upgradeParam: "ai_notetaker",
  },
};
