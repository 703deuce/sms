/**
 * Wireframe reference data — shown when the workspace has no Smart Routing
 * activity yet so marketing layouts match product mockups.
 */

export const WIREFRAME_OVERVIEW_METRICS = {
  activeFlows: 8,
  routedToday: 126,
  recovered: 19,
  failures: 2,
  trends: {
    activeFlows: 12,
    routedToday: 15,
    recovered: 9,
    failures: -25,
  },
};

export type WireframeFlowRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  businessNumberE164: string;
  todayCalls: number;
  primaryDestination: string;
  updatedLabel: string;
  isDemo: true;
};

export const WIREFRAME_DEMO_FLOWS: WireframeFlowRow[] = [
  {
    id: "demo-main",
    name: "Main Business Line",
    type: "phone_menu",
    status: "active",
    businessNumberE164: "+15715550188",
    todayCalls: 64,
    primaryDestination: "Front Desk + Ring Group",
    updatedLabel: "15 min ago",
    isDemo: true,
  },
  {
    id: "demo-mctb",
    name: "Missed Call Recovery",
    type: "missed_call_recovery",
    status: "active",
    businessNumberE164: "+15715550188",
    todayCalls: 21,
    primaryDestination: "Text Line + SMS Consent",
    updatedLabel: "1 hr ago",
    isDemo: true,
  },
  {
    id: "demo-after",
    name: "After Hours Flow",
    type: "after_hours",
    status: "active",
    businessNumberE164: "+15715550188",
    todayCalls: 14,
    primaryDestination: "On-Call Technician",
    updatedLabel: "Yesterday",
    isDemo: true,
  },
  {
    id: "demo-dept",
    name: "Billing & Appointments",
    type: "department",
    status: "draft",
    businessNumberE164: "+17035550131",
    todayCalls: 0,
    primaryDestination: "Susan + Office",
    updatedLabel: "2 hrs ago",
    isDemo: true,
  },
  {
    id: "demo-emergency",
    name: "Emergency Service Menu",
    type: "custom",
    status: "paused",
    businessNumberE164: "+15405550110",
    todayCalls: 7,
    primaryDestination: "AI Receptionist Amy",
    updatedLabel: "3 days ago",
    isDemo: true,
  },
];

export const WIREFRAME_AUDIO_ASSETS = [
  {
    id: "demo-audio-1",
    name: "Main Greeting",
    sourceType: "elevenlabs",
    voiceDetails: "Astra / ElevenLabs",
    usedBy: "Main Business Line",
    durationMs: 12000,
    versionNumber: 3,
    updatedLabel: "15 min ago",
    status: "ready",
    isDemo: true,
  },
  {
    id: "demo-audio-2",
    name: "After Hours Greeting",
    sourceType: "recording",
    voiceDetails: "Owner Voice",
    usedBy: "After Hours Flow",
    durationMs: 9000,
    versionNumber: 2,
    updatedLabel: "1 hr ago",
    status: "ready",
    isDemo: true,
  },
  {
    id: "demo-audio-3",
    name: "Text Recovery Consent Prompt",
    sourceType: "telnyx_tts",
    voiceDetails: "Telnyx TTS",
    usedBy: "Missed Call Recovery",
    durationMs: 8000,
    versionNumber: 1,
    updatedLabel: "2 hrs ago",
    status: "draft",
    isDemo: true,
  },
  {
    id: "demo-audio-4",
    name: "Holiday Closure Greeting",
    sourceType: "recording",
    voiceDetails: "Recorded in Transovo",
    usedBy: "—",
    durationMs: 11000,
    versionNumber: 1,
    updatedLabel: "Yesterday",
    status: "needs_review",
    isDemo: true,
  },
];

export function shouldUseWireframeOverview(
  flowsCount: number,
  metrics: { routedToday: number } | null,
): boolean {
  return flowsCount === 0 && (metrics == null || metrics.routedToday === 0);
}

export function shouldUseWireframeAudio(count: number): boolean {
  return count === 0;
}
