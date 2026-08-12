export type CallDirection = "inbound" | "outbound";
export type CallAgentType = "ai" | "human";

export type RealtorCallRow = {
  id: string;
  dateTime: string;
  direction: CallDirection;
  callerName: string;
  callerPhone: string;
  callerInitials: string;
  number: string;
  numberLabel: string;
  agent: string;
  agentType: CallAgentType;
  agentStatus?: string;
  outcome: string;
  outcomeClass: string;
  duration: string;
  durationSeconds: number;
  disposition: string;
  notes?: string;
  tags?: string[];
  aiModel?: string;
  isVoicemail?: boolean;
  hasRecording?: boolean;
  hasTranscript?: boolean;
};

export const CALLS_KPI = {
  total: 256,
  inbound: 164,
  outbound: 92,
  aiAnswered: 143,
  voicemails: 28,
  avgDuration: "03:42",
};

export const ALL_CALLS_DATA: RealtorCallRow[] = [
  {
    id: "call-1",
    dateTime: "May 20, 2025 2:42 PM",
    direction: "inbound",
    callerName: "Jennifer Smith",
    callerPhone: "(703) 555-0123",
    callerInitials: "JS",
    number: "(571) 555-0198",
    numberLabel: "Main Line",
    agent: "AI Receptionist",
    agentType: "ai",
    agentStatus: "Answered",
    outcome: "Appointment Booked",
    outcomeClass: "bg-emerald-50 text-emerald-700",
    duration: "04:21",
    durationSeconds: 261,
    disposition: "Completed",
    notes: "Interested in 3 bedroom homes $500k budget",
    tags: ["New Lead", "Buyer"],
    aiModel: "Transovo v2.3",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "call-2",
    dateTime: "May 20, 2025 1:15 PM",
    direction: "outbound",
    callerName: "Marcus Green",
    callerPhone: "(703) 555-0456",
    callerInitials: "MG",
    number: "(571) 555-0198",
    numberLabel: "Main Line",
    agent: "Sarah Johnson",
    agentType: "human",
    agentStatus: "Human",
    outcome: "Interested",
    outcomeClass: "bg-blue-50 text-blue-700",
    duration: "06:12",
    durationSeconds: 372,
    disposition: "Follow Up",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "call-3",
    dateTime: "May 20, 2025 11:30 AM",
    direction: "inbound",
    callerName: "Amanda Reed",
    callerPhone: "(703) 555-0789",
    callerInitials: "AR",
    number: "(571) 555-0198",
    numberLabel: "Main Line",
    agent: "AI Receptionist",
    agentType: "ai",
    agentStatus: "Answered",
    outcome: "Voicemail",
    outcomeClass: "bg-orange-50 text-orange-700",
    duration: "01:45",
    durationSeconds: 105,
    disposition: "New Lead",
    isVoicemail: true,
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "call-4",
    dateTime: "May 19, 2025 4:55 PM",
    direction: "inbound",
    callerName: "David Brown",
    callerPhone: "(703) 555-0321",
    callerInitials: "DB",
    number: "(571) 555-0198",
    numberLabel: "Main Line",
    agent: "AI Receptionist",
    agentType: "ai",
    agentStatus: "Answered",
    outcome: "No Answer",
    outcomeClass: "bg-red-50 text-red-700",
    duration: "00:32",
    durationSeconds: 32,
    disposition: "Follow Up",
    hasRecording: false,
    hasTranscript: false,
  },
  {
    id: "call-5",
    dateTime: "May 19, 2025 3:20 PM",
    direction: "outbound",
    callerName: "Lisa Chen",
    callerPhone: "(703) 555-0654",
    callerInitials: "LC",
    number: "(571) 555-0198",
    numberLabel: "Main Line",
    agent: "Michael Brown",
    agentType: "human",
    agentStatus: "Human",
    outcome: "Information Provided",
    outcomeClass: "bg-purple-50 text-purple-700",
    duration: "03:08",
    durationSeconds: 188,
    disposition: "Nurturing",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "call-6",
    dateTime: "May 19, 2025 10:05 AM",
    direction: "inbound",
    callerName: "Robert Taylor",
    callerPhone: "(703) 555-0987",
    callerInitials: "RT",
    number: "(571) 555-0198",
    numberLabel: "Main Line",
    agent: "AI Receptionist",
    agentType: "ai",
    agentStatus: "Answered",
    outcome: "Transferred",
    outcomeClass: "bg-cyan-50 text-cyan-700",
    duration: "02:54",
    durationSeconds: 174,
    disposition: "Transferred",
    aiModel: "Transovo v2.3",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "call-7",
    dateTime: "May 18, 2025 5:40 PM",
    direction: "outbound",
    callerName: "Emily Davis",
    callerPhone: "(703) 555-0147",
    callerInitials: "ED",
    number: "(571) 555-0198",
    numberLabel: "Main Line",
    agent: "Sarah Johnson",
    agentType: "human",
    agentStatus: "Human",
    outcome: "Not Interested",
    outcomeClass: "bg-gray-100 text-gray-700",
    duration: "01:22",
    durationSeconds: 82,
    disposition: "Disqualified",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "call-8",
    dateTime: "May 18, 2025 9:15 AM",
    direction: "inbound",
    callerName: "Anthony Johnson",
    callerPhone: "(571) 555-1234",
    callerInitials: "AJ",
    number: "(571) 555-0198",
    numberLabel: "Main Line",
    agent: "AI Receptionist",
    agentType: "ai",
    agentStatus: "Answered",
    outcome: "Appointment Booked",
    outcomeClass: "bg-emerald-50 text-emerald-700",
    duration: "05:03",
    durationSeconds: 303,
    disposition: "Completed",
    tags: ["Hot Lead", "Buyer"],
    aiModel: "Transovo v2.3",
    hasRecording: true,
    hasTranscript: true,
  },
];

export const VOICEMAILS_KPI = {
  total: 28,
  new: 24,
  uniqueCallers: 21,
  avgDuration: "01:32",
  callsToVmPct: "38%",
};

export const VOICEMAILS_DATA = ALL_CALLS_DATA.filter((c) => c.isVoicemail).concat([
  {
    id: "vm-2",
    dateTime: "May 19, 2025, 8:22 AM",
    direction: "inbound" as const,
    callerName: "Brian Thompson",
    callerPhone: "(703) 555-0555",
    callerInitials: "BT",
    number: "(571) 555-0198",
    numberLabel: "Main Line",
    agent: "AI Receptionist",
    agentType: "ai" as const,
    outcome: "Voicemail",
    outcomeClass: "bg-orange-50 text-orange-700",
    duration: "01:12",
    durationSeconds: 72,
    disposition: "Contacted",
    isVoicemail: true,
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "vm-3",
    dateTime: "May 18, 2025, 6:10 PM",
    direction: "inbound" as const,
    callerName: "Sarah Davis",
    callerPhone: "(703) 555-0666",
    callerInitials: "SD",
    number: "(571) 555-0198",
    numberLabel: "Main Line",
    agent: "AI Receptionist",
    agentType: "ai" as const,
    outcome: "Voicemail",
    outcomeClass: "bg-orange-50 text-orange-700",
    duration: "02:05",
    durationSeconds: 125,
    disposition: "Not Interested",
    isVoicemail: true,
    hasRecording: true,
    hasTranscript: false,
  },
]);

export const TRANSCRIPTS_KPI = {
  total: 256,
  ai: 180,
  human: 58,
  voicemails: 18,
  avgLength: "02:48",
};

export const TRANSCRIPTS_DATA = ALL_CALLS_DATA.filter((c) => c.hasTranscript);

export const RECORDINGS_KPI = {
  total: 256,
  inbound: 142,
  outbound: 114,
  human: 98,
  ai: 158,
  totalDuration: "18:42:19",
};

export const RECORDINGS_DATA = ALL_CALLS_DATA.filter((c) => c.hasRecording);

export const JENNIFER_TRANSCRIPT = [
  {
    speaker: "AI Receptionist",
    role: "ai" as const,
    text: "Thank you for calling Blue Ridge Realty. This is Amy, your AI assistant. How can I help you today?",
  },
  {
    speaker: "Jennifer Smith",
    role: "caller" as const,
    text: "Hi, I'm looking for a three-bedroom home around $500,000 in the Woodbridge area.",
  },
  {
    speaker: "AI Receptionist",
    role: "ai" as const,
    text: "I'd be happy to help with that. Are you currently working with a realtor, and what's your timeline for purchasing?",
  },
  {
    speaker: "Jennifer Smith",
    role: "caller" as const,
    text: "We're hoping to buy within the next three months. No realtor yet.",
  },
  {
    speaker: "AI Receptionist",
    role: "ai" as const,
    text: "Perfect. I can schedule a buyer consultation with one of our agents. Would Tuesday at 4:30 PM work for you?",
  },
  {
    speaker: "Jennifer Smith",
    role: "caller" as const,
    text: "Yes, that works great. Thank you!",
  },
];

export type CallsTab = "all" | "inbound" | "outbound" | "ai" | "human";

export function matchesCallsTab(row: RealtorCallRow, tab: CallsTab): boolean {
  switch (tab) {
    case "inbound":
      return row.direction === "inbound";
    case "outbound":
      return row.direction === "outbound";
    case "ai":
      return row.agentType === "ai";
    case "human":
      return row.agentType === "human";
    default:
      return true;
  }
}

export function countByCallsTab(rows: RealtorCallRow[]): Record<CallsTab, number> {
  return {
    all: rows.length,
    inbound: rows.filter((r) => matchesCallsTab(r, "inbound")).length,
    outbound: rows.filter((r) => matchesCallsTab(r, "outbound")).length,
    ai: rows.filter((r) => matchesCallsTab(r, "ai")).length,
    human: rows.filter((r) => matchesCallsTab(r, "human")).length,
  };
}
