export type AnswerTiming =
  | "every_call"
  | "after_hours"
  | "nobody_answers"
  | "overflow";

export type CapabilityId =
  | "answer_questions"
  | "take_messages"
  | "collect_info"
  | "book_appointments"
  | "transfer_calls"
  | "send_text";

export type CollectFieldId = "name" | "phone" | "reason" | "email" | "address";

export type ReceptionistWizardState = {
  agentName: string;
  businessName: string;
  businessDescription: string;
  /** What the receptionist should do on calls — always loaded (YOUR JOB). */
  agentJobInstructions: string;
  /** Optional owner freeform notes (additional training). */
  additionalInstructions: string;
  businessHours: string;
  serviceArea: string;
  coreServices: string;
  pricingNotes: string;
  importantFacts: string;
  businessAddress: string;
  answerTiming: AnswerTiming;
  greeting: string;
  language: string;
  timezone: string;
  capabilities: CapabilityId[];
  collectFields: CollectFieldId[];
  voiceId: string;
  voiceLabel: string;
  /** OpenAI Realtime speech speed (0.5–2.0). */
  voiceSpeed: number;
  /** Server VAD threshold (0–1). Higher = less sensitive to background noise. */
  vadThreshold: number;
  /** Silence duration (ms) before the agent treats the caller as done speaking. */
  vadSilenceMs: number;
  /** Audio padding (ms) before detected speech start. */
  vadPrefixMs: number;
  agentId?: string;
};

export const WIZARD_STEPS = [
  { id: "about", label: "About your receptionist" },
  { id: "capabilities", label: "What should your agent do?" },
  { id: "voice", label: "Voice & Test" },
] as const;

export const ANSWER_TIMING_OPTIONS: Array<{
  id: AnswerTiming;
  label: string;
  description: string;
}> = [
  {
    id: "every_call",
    label: "Answer every call",
    description: "They handle all incoming calls for you.",
  },
  {
    id: "after_hours",
    label: "After-hours only",
    description: "Cover nights, weekends, and holidays.",
  },
  {
    id: "nobody_answers",
    label: "When I don't answer",
    description: "Ring your team first; Amy picks up when nobody answers.",
  },
  {
    id: "overflow",
    label: "Overflow only",
    description: "Handle overflow when lines are busy.",
  },
];

export const CAPABILITY_OPTIONS: Array<{
  id: CapabilityId;
  label: string;
  description: string;
  defaultOn?: boolean;
}> = [
  {
    id: "answer_questions",
    label: "Answer questions",
    description: "Amy will use your business knowledge to answer caller questions.",
    defaultOn: true,
  },
  {
    id: "take_messages",
    label: "Take messages",
    description: "Amy will take messages when you're busy and send them to your team.",
    defaultOn: true,
  },
  {
    id: "collect_info",
    label: "Collect caller information",
    description: "Amy will ask for and collect specific information from callers.",
    defaultOn: true,
  },
  {
    id: "book_appointments",
    label: "Book appointments",
    description: "Amy can check availability and book appointments into your calendar.",
  },
  {
    id: "transfer_calls",
    label: "Transfer calls",
    description: "Amy can transfer calls to you or your team members.",
  },
  {
    id: "send_text",
    label: "Send text messages",
    description: "Amy can send SMS confirmations, links, or follow-ups.",
  },
];

export const DEFAULT_COLLECT_FIELDS: Array<{
  id: CollectFieldId;
  label: string;
  required: boolean;
}> = [
  { id: "name", label: "Full name", required: true },
  { id: "phone", label: "Phone number", required: true },
  { id: "reason", label: "Reason for calling", required: false },
];

import {
  DEFAULT_RECEPTIONIST_ELEVENLABS_VOICE_ID,
  listEnabledReceptionistElevenLabsVoices,
} from "@/lib/voice/elevenlabs/receptionist-voice-catalog";

export const WIZARD_VOICES = listEnabledReceptionistElevenLabsVoices().map((v) => ({
  id: v.id,
  label: v.label,
  badge: v.badge,
  description: `${v.description} · ${v.style} · ${v.accent}`,
  locale: "ElevenLabs Flash",
}));
