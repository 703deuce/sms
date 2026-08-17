/**
 * Personal product wireframe data — fills marketing layouts when live activity
 * is sparse so pages match product mockups (same pattern as smart-routing wireframe).
 */

export function usePersonalWireframe(count: number, threshold = 8): boolean {
  return count < threshold;
}

export const WIREFRAME_PORTING_SUMMARY = {
  inProgress: 2,
  actionRequired: 1,
  scheduled: 3,
  completed: 12,
  completedSub: "This month",
};

export const WIREFRAME_PORT_IN_STEPS = [
  { n: 1, title: "Bring Your Number", desc: "Enter one or more numbers you want to port to Transovo.", required: true },
  { n: 2, title: "Current Carrier", desc: "Who currently provides service for these numbers?", required: true },
  { n: 3, title: "Authorized Account Holder", desc: "Name and contact on the losing carrier account.", required: true },
  { n: 4, title: "Service Address", desc: "Billing or service address on file with your carrier.", required: true },
  { n: 5, title: "Numbers Remaining With Current Carrier", desc: "Optional numbers staying with your old carrier.", required: false },
  { n: 6, title: "Upload Supporting Documents", desc: "Recent bill, CSR, or LOA as required.", required: true },
  { n: 7, title: "Authorization", desc: "Sign the letter of authorization.", required: true },
  { n: 8, title: "Transfer Timing", desc: "Preferred port date and window.", required: false },
  { n: 9, title: "Review & Submit", desc: "Confirm details before submitting.", required: true },
];

export const WIREFRAME_PORT_IN_STEPPER = ["Numbers", "Carrier", "Account", "Address", "Documents", "Authorization", "Review"];

export const WIREFRAME_PORT_OUT_STEPS = [
  { n: 1, title: "Port Out Details", desc: "Select numbers and verify account credentials.", required: true },
  { n: 2, title: "Account & Security", desc: "Unlock PIN and confirm port-out eligibility.", required: true },
  { n: 3, title: "New Carrier Details", desc: "Destination carrier and account information.", required: true },
  { n: 4, title: "Authorized Contact", desc: "Contact authorized on the gaining carrier account.", required: true },
  { n: 5, title: "Timing", desc: "Preferred transfer date.", required: false },
  { n: 6, title: "Review & Confirm", desc: "Review and submit your port-out request.", required: true },
];

export const WIREFRAME_PORT_OUT_STEPPER = [
  "Port Out Details",
  "Account & Security",
  "New Carrier Details",
  "Authorized Contact",
  "Timing",
  "Review & Confirm",
];

export const WIREFRAME_PORT_REQUESTS = [
  {
    id: "demo-p1",
    phone: "+18663464256",
    status: "Carrier Review",
    statusTone: "blue" as const,
    submitted: "Aug 15, 2026",
    confirmed: "—",
    action: "None",
    isDemo: true,
  },
  {
    id: "demo-p2",
    phone: "+15714073615",
    status: "Action Required",
    statusTone: "orange" as const,
    submitted: "Aug 14, 2026",
    confirmed: "—",
    action: "Upload recent bill",
    isDemo: true,
  },
  {
    id: "demo-p3",
    phone: "+14155550198",
    status: "Scheduled",
    statusTone: "purple" as const,
    submitted: "Aug 10, 2026",
    confirmed: "Aug 20, 2026",
    action: "None",
    isDemo: true,
  },
];

export const WIREFRAME_PORT_OUT_REQUESTS = [
  {
    id: "demo-o1",
    phone: "+18663464256",
    status: "Pending Review",
    statusTone: "blue" as const,
    submitted: "Aug 15, 2026",
    scheduled: "—",
    action: "None",
    isDemo: true,
  },
  {
    id: "demo-o2",
    phone: "+15714073615",
    status: "Awaiting Confirmation",
    statusTone: "orange" as const,
    submitted: "Aug 14, 2026",
    scheduled: "—",
    action: "Confirm with new carrier",
    isDemo: true,
  },
  {
    id: "demo-o3",
    phone: "+14155550198",
    status: "Scheduled",
    statusTone: "purple" as const,
    submitted: "Aug 10, 2026",
    scheduled: "Aug 20, 2026",
    action: "None",
    isDemo: true,
  },
];

export const WIREFRAME_ACTIVITY_ROWS = [
  {
    id: "demo-a1",
    caller: "+17035559191",
    callerName: "John Smith",
    calledNumber: "+15714073615",
    calledLabel: "Main Line",
    route: "Forward to Anthony's Cell",
    routeDevice: "Mobile",
    outcome: "Answered",
    answered: true,
    voicemail: false,
    blocked: false,
    smartRouted: true,
    ringDurationSeconds: 12,
    durationSeconds: 154,
    date: "May 15, 2026",
    time: "3:42 PM",
    startedAt: "3:42:03 PM",
    connectedAt: "3:42:15 PM",
    endedAt: "3:45:18 PM",
    callId: "call_8f3a2b1c9d0e7f6a5b4c3d2e1f0a9b8",
    handlingType: "Forwarding Rule",
    callerIdMode: "Preserve Caller ID",
    screening: "Call Screening Basic",
    isDemo: true,
  },
  {
    id: "demo-a2",
    caller: "+12025550199",
    callerName: "Sarah Chen",
    calledNumber: "+15714073615",
    calledLabel: "Main Line",
    route: "Forward to Office",
    routeDevice: "Landline",
    outcome: "Voicemail",
    answered: false,
    voicemail: true,
    blocked: false,
    ringDurationSeconds: 28,
    durationSeconds: 38,
    date: "May 14, 2026",
    time: "11:18 AM",
    isDemo: true,
  },
  {
    id: "demo-a3",
    caller: "+17035559202",
    callerName: "Unknown",
    calledNumber: "+18663464256",
    calledLabel: "Sales Line",
    route: "Smart Routing",
    routeDevice: "Menu",
    outcome: "Blocked",
    answered: false,
    voicemail: false,
    blocked: true,
    ringDurationSeconds: 0,
    durationSeconds: 0,
    date: "May 14, 2026",
    time: "9:05 AM",
    isDemo: true,
  },
  {
    id: "demo-a4",
    caller: "+17035559303",
    callerName: "Steve Johnson",
    calledNumber: "+15714073615",
    calledLabel: "Main Line",
    route: "Forward to Anthony's Cell",
    routeDevice: "Mobile",
    outcome: "Missed",
    answered: false,
    voicemail: false,
    blocked: false,
    smartRouted: false,
    ringDurationSeconds: 30,
    durationSeconds: 0,
    date: "May 13, 2026",
    time: "4:22 PM",
    isDemo: true,
  },
  {
    id: "demo-a5",
    caller: "+14155550198",
    callerName: "Amy Brooks",
    calledNumber: "+18663464256",
    calledLabel: "Sales Line",
    route: "Smart Routing",
    routeDevice: "Queue",
    outcome: "Answered",
    answered: true,
    voicemail: false,
    blocked: false,
    smartRouted: true,
    ringDurationSeconds: 8,
    durationSeconds: 245,
    date: "May 13, 2026",
    time: "2:10 PM",
    isDemo: true,
  },
  {
    id: "demo-a6",
    caller: "+12025558812",
    callerName: "Michael Torres",
    calledNumber: "+18665779653",
    calledLabel: "Support Line",
    route: "Forward to Support Queue",
    routeDevice: "Queue",
    outcome: "Failed",
    answered: false,
    voicemail: false,
    blocked: false,
    smartRouted: false,
    ringDurationSeconds: 45,
    durationSeconds: 0,
    date: "May 12, 2026",
    time: "10:45 AM",
    isDemo: true,
  },
  {
    id: "demo-a7",
    caller: "+15405559012",
    callerName: "Lisa Park",
    calledNumber: "+15714073615",
    calledLabel: "Main Line",
    route: "Forward to Home",
    routeDevice: "Landline",
    outcome: "Voicemail",
    answered: false,
    voicemail: true,
    blocked: false,
    smartRouted: false,
    ringDurationSeconds: 22,
    durationSeconds: 52,
    date: "May 12, 2026",
    time: "8:30 AM",
    isDemo: true,
  },
  {
    id: "demo-a8",
    caller: "+17035552408",
    callerName: "Anthony Rivera",
    calledNumber: "+14155550198",
    calledLabel: "After Hours",
    route: "Voicemail",
    routeDevice: "System",
    outcome: "Answered",
    answered: true,
    voicemail: false,
    blocked: false,
    smartRouted: false,
    ringDurationSeconds: 5,
    durationSeconds: 180,
    date: "May 11, 2026",
    time: "6:15 PM",
    isDemo: true,
  },
];

export const WIREFRAME_BLOCKED_ROWS = [
  {
    id: "demo-b1",
    phone: "+17035559191",
    label: "Spam Caller",
    scope: "All Numbers",
    scopeTone: "purple" as const,
    behavior: "Disconnect",
    behaviorTone: "red" as const,
    blockedCalls: 18,
    lastAttempt: "Today, 4:12 PM",
    added: "Aug 12, 2026",
    addedBy: "Alex Rivera",
    isDemo: true,
  },
  {
    id: "demo-b2",
    phone: "+12025558812",
    label: "Fraud",
    scope: "Main Line",
    scopeTone: "blue" as const,
    behavior: "Unavailable Message",
    behaviorTone: "orange" as const,
    blockedCalls: 6,
    lastAttempt: "Yesterday, 2:30 PM",
    added: "Aug 8, 2026",
    addedBy: "Alex Rivera",
    isDemo: true,
  },
];

export const WIREFRAME_BLOCKED_ATTEMPTS = [
  { id: "demo-ba1", at: "Today, 4:12 PM", outcome: "Call disconnected" },
  { id: "demo-ba2", at: "Yesterday, 2:30 PM", outcome: "Call disconnected" },
  { id: "demo-ba3", at: "Aug 10, 2026 · 9:15 AM", outcome: "Unavailable message played" },
];

export const WIREFRAME_USAGE_BY_NUMBER = [
  { number: "+15714073615", friendlyName: "Main Line", calls: 312, forwarded: 342, vm: 12, transcribe: 11, pct: 63, trend: [20, 35, 28, 42, 38, 45, 50] },
  { number: "+18663464256", friendlyName: "Sales Line", calls: 98, forwarded: 112, vm: 8, transcribe: 7, pct: 21, trend: [8, 12, 10, 14, 11, 9, 15] },
  { number: "+18665779653", friendlyName: "Support Line", calls: 64, forwarded: 88, vm: 6, transcribe: 5, pct: 16, trend: [5, 7, 6, 8, 7, 9, 10] },
  { number: "+14155550198", friendlyName: "After Hours", calls: 24, forwarded: 0, vm: 4, transcribe: 3, pct: 2, trend: [2, 1, 3, 2, 1, 2, 1] },
];

export const WIREFRAME_ANALYTICS_KPIS = {
  totalCalls: 1284,
  answered: 876,
  missed: 256,
  voicemails: 112,
  failed: 40,
  blocked: 0,
  forwardedMinutes: 542,
  avgDurationSec: 154,
  trends: { total: 12.4, answered: 68.2, missed: -6.8, voicemails: 8.7, forwarded: 15.6, avgDuration: 7.3 },
  periodLabel: "Apr 28 – May 27, 2026",
};

export const WIREFRAME_ANALYTICS_CHART_LABELS = [
  "Apr 28",
  "May 2",
  "May 6",
  "May 10",
  "May 14",
  "May 18",
  "May 22",
  "May 26",
];

export const WIREFRAME_ANALYTICS_BY_NUMBER = [
  {
    number: "+15714073615",
    friendlyName: "Main Line",
    calls: 312,
    answered: 210,
    missed: 58,
    voicemail: 12,
    minutes: 342,
    answerRate: 67.3,
    trend: [20, 35, 28, 42, 38, 45, 50],
  },
  {
    number: "+18663464256",
    friendlyName: "Sales Line",
    calls: 198,
    answered: 142,
    missed: 32,
    voicemail: 8,
    minutes: 112,
    answerRate: 71.7,
    trend: [8, 12, 10, 14, 11, 9, 15],
  },
  {
    number: "+18665779653",
    friendlyName: "Support Line",
    calls: 164,
    answered: 98,
    missed: 28,
    voicemail: 6,
    minutes: 88,
    answerRate: 59.8,
    trend: [5, 7, 6, 8, 7, 9, 10],
  },
  {
    number: "+14155550198",
    friendlyName: "After Hours",
    calls: 84,
    answered: 52,
    missed: 18,
    voicemail: 4,
    minutes: 24,
    answerRate: 61.9,
    trend: [2, 1, 3, 2, 1, 2, 1],
  },
];

export const WIREFRAME_ANALYTICS_TOP_NUMBERS = [
  { rank: 1, number: "+18663464256", name: "Sales Line", rate: 71.7, trend: "up" as const },
  { rank: 2, number: "+14155550198", name: "After Hours", rate: 61.9, trend: "up" as const },
  { rank: 3, number: "+15714073615", name: "Main Line", rate: 67.3, trend: "flat" as const },
  { rank: 4, number: "+18665779653", name: "Support Line", rate: 59.8, trend: "down" as const },
  { rank: 5, number: "+17035552408", name: "Office Forward", rate: 58.2, trend: "up" as const },
];

export const WIREFRAME_ANALYTICS_INSIGHTS = [
  {
    id: "i1",
    title: "Answer rate improved",
    detail: "+4.2% vs previous period",
    tone: "green" as const,
  },
  {
    id: "i2",
    title: "Peak hour detected",
    detail: "2–4 PM weekdays",
    tone: "orange" as const,
  },
  {
    id: "i3",
    title: "Voicemails up",
    detail: "+8.7% vs previous period",
    tone: "purple" as const,
  },
];

export const WIREFRAME_ANALYTICS_MISSED = [
  { reason: "No Answer", count: 142, pct: 55.5 },
  { reason: "Busy", count: 48, pct: 18.8 },
  { reason: "Destination Failed", count: 32, pct: 12.5 },
  { reason: "Rejected", count: 24, pct: 9.4 },
  { reason: "Timed Out", count: 18, pct: 7.0 },
];

export const WIREFRAME_ANALYTICS_FORWARDING = {
  forwardedCalls: 428,
  forwardedMinutes: 542,
  avgRingSeconds: 18,
  connections: 376,
  destinations: [
    { label: "Anthony's Cell", pct: 45 },
    { label: "Office", pct: 32 },
    { label: "Support Queue", pct: 23 },
  ],
};

export const WIREFRAME_ANALYTICS_SMART_ROUTING = {
  routesEvaluated: 156,
  efficiencyPct: 94,
  menuSelections: [
    { label: "Press 1 — Sales", pct: 52 },
    { label: "Press 2 — Support", pct: 31 },
    { label: "Press 3 — Billing", pct: 17 },
  ],
};

export const WIREFRAME_ANALYTICS_USAGE = {
  totalNumbers: 128,
  activeNumbers: 116,
  minutesUsed: 542,
  minutesLimit: 1000,
  voicemailStorageGb: 2.4,
  voicemailStorageLimitGb: 10,
};

export const WIREFRAME_FORWARDING_DESTINATIONS = [
  { number: "+15714776175", label: "Anthony's Cell", ringSeconds: 25 },
  { number: "+17035552408", label: "Office", ringSeconds: 20 },
  { number: "+15405559012", label: "Home", ringSeconds: 15 },
];

export const WIREFRAME_FORWARDING_ACTIVITY = [
  {
    id: "demo-f1",
    caller: "+17035559191",
    calledNumber: "+15714073615",
    forwardedTo: "+15714776175",
    outcome: "Answered",
    outcomeTone: "green" as const,
    date: "May 15, 2026",
    time: "3:42 PM",
  },
  {
    id: "demo-f2",
    caller: "+12025550199",
    calledNumber: "+15714073615",
    forwardedTo: "Voicemail",
    outcome: "No Answer",
    outcomeTone: "purple" as const,
    date: "May 14, 2026",
    time: "11:18 AM",
  },
  {
    id: "demo-f3",
    caller: "+15714776175",
    calledNumber: "+15714073615",
    forwardedTo: "+17035552408",
    outcome: "Backup Route",
    outcomeTone: "orange" as const,
    date: "May 14, 2026",
    time: "9:05 AM",
  },
];

export const WIREFRAME_FORWARDING_USAGE = {
  minutesUsed: 436,
  minutesLimit: 600,
  callsForwarded: 128,
  statusSub: "Sequential Mode",
};

export const WIREFRAME_FORWARDING_FALLBACK = [
  {
    condition: "If No One Answers",
    action: "Send to Transovo Voicemail",
    pills: ["Greeting: Main Line Greeting", "Transcription: On"],
  },
  {
    condition: "If Destination Is Busy",
    action: "Try Another Number",
  },
  {
    condition: "If Destination Cannot Be Reached",
    action: "Play Announcement",
    pills: ["This number is no longer in service. Please try again later."],
  },
];

export const WIREFRAME_FORWARDING_SCHEDULE = [
  { label: "Mon–Fri 9:00 AM – 5:00 PM", dest: "Forward to destinations", icon: "calendar" as const },
  { label: "Evenings", dest: "Voicemail", icon: "clock" as const },
  { label: "Weekends", dest: "Announcement", icon: "weekend" as const },
];

export const WIREFRAME_VOICEMAIL_MESSAGES = [
  {
    id: "demo-vm1",
    callerName: "John Smith",
    callerNumber: "+17035559191",
    calledNumber: "+15714073615",
    calledLabel: "Main Line",
    durationSec: 38,
    avatarTone: "blue" as const,
    transcript:
      "Hi, this is John Smith. I was calling about the listing on Maple Street. Please call me back when you get a chance. Thanks.",
    summary: "Caller asking about Maple Street listing and requesting a callback.",
    readAt: null,
    createdAt: "2026-05-15T15:42:00",
    isDemo: true,
  },
  {
    id: "demo-vm2",
    callerName: "Sarah Chen",
    callerNumber: "+12025550199",
    calledNumber: "+15714073615",
    calledLabel: "Main Line",
    durationSec: 22,
    avatarTone: "purple" as const,
    transcript: "Just checking in on our appointment tomorrow. Let me know if the time still works.",
    summary: "Appointment confirmation for tomorrow.",
    readAt: "2026-05-14T10:00:00",
    createdAt: "2026-05-14T11:18:00",
    isDemo: true,
  },
  {
    id: "demo-vm3",
    callerName: "Unknown",
    callerNumber: "+17035559202",
    calledNumber: "+18663464256",
    calledLabel: "Sales Line",
    durationSec: 15,
    avatarTone: "orange" as const,
    transcript: "Please return my call regarding the property inquiry.",
    summary: "Property inquiry callback request.",
    readAt: "2026-05-13T08:30:00",
    createdAt: "2026-05-13T09:05:00",
    isDemo: true,
  },
  {
    id: "demo-vm4",
    callerName: "Steve Johnson",
    callerNumber: "+17035559303",
    calledNumber: "+15714073615",
    calledLabel: "Main Line",
    durationSec: 45,
    avatarTone: "green" as const,
    transcript: "Following up on the open house this weekend. Let me know if you need anything else.",
    summary: "Open house follow-up.",
    readAt: "2026-05-12T14:00:00",
    createdAt: "2026-05-12T16:22:00",
    isDemo: true,
  },
  {
    id: "demo-vm5",
    callerName: "Amy Brooks",
    callerNumber: "+14155550198",
    calledNumber: "+15714073615",
    calledLabel: "Main Line",
    durationSec: 31,
    avatarTone: "pink" as const,
    transcript: "Hi, I'd like to schedule a showing for the condo downtown. Please call me back.",
    summary: "Showing request for downtown condo.",
    readAt: null,
    createdAt: "2026-05-11T10:15:00",
    isDemo: true,
  },
];

export const WIREFRAME_VOICEMAIL_GREETINGS = [
  {
    id: "g-main",
    label: "Main Line",
    status: "Active" as const,
    durationSec: 12,
    updated: "May 10, 2026",
  },
  {
    id: "g-vacation",
    label: "Vacation",
    status: "Inactive" as const,
    durationSec: 18,
    updated: "Apr 22, 2026",
  },
  {
    id: "g-after",
    label: "After Hours",
    status: "Inactive" as const,
    durationSec: 15,
    updated: "Mar 8, 2026",
  },
];

export const WIREFRAME_VOICEMAIL_ACTIVITY = [
  {
    id: "va1",
    icon: "mic" as const,
    text: "Greeting updated",
    detail: "Main Line Greeting",
    time: "Today, 2:15 PM",
  },
  {
    id: "va2",
    icon: "waveform" as const,
    text: "Auto-transcription enabled",
    detail: "Main Line",
    time: "Yesterday, 9:30 AM",
  },
  {
    id: "va3",
    icon: "mail" as const,
    text: "Email alert delivered",
    detail: "Voicemail from John Smith",
    time: "May 15, 3:45 PM",
  },
];

export const WIREFRAME_VOICEMAIL_STORAGE = {
  messagesStored: 42,
  audioMb: 52,
  transcripts: 40,
  retentionDays: 90,
};

export const WIREFRAME_VOICEMAIL_FORWARDING = {
  forwardingEnabled: true,
  ringSeconds: 25,
  directToVoicemail: false,
};

export const WIREFRAME_ROUTING_HEALTH = [
  {
    id: "rh1",
    tone: "red" as const,
    text: "5 failed calls to Support Queue",
    action: "Investigate",
  },
  {
    id: "rh2",
    tone: "orange" as const,
    text: "High voicemail rate on Sales Line",
    action: "View Details",
  },
];

export const WIREFRAME_RECENT_CALL_EVENTS = [
  { id: "rce1", icon: "answered" as const, text: "Call answered", number: "+1 (703) 555-9191", time: "3:42 PM" },
  { id: "rce2", icon: "voicemail" as const, text: "Voicemail received", number: "+1 (202) 555-0199", time: "11:18 AM" },
  { id: "rce3", icon: "missed" as const, text: "Missed call", number: "+1 (703) 555-9202", time: "9:05 AM" },
];

export const WIREFRAME_VOICEMAIL_KPIS = {
  total: 42,
  unread: 6,
  minutes: 38,
};

export const WIREFRAME_OVERVIEW_KPIS = {
  phoneNumbers: 0,
  totalExtensions: 0,
  forwardedNumbers: 0,
  agents: 0,
  monthlySpend: "$12.45",
  activeConversations: 0,
};

export const WIREFRAME_OVERVIEW_CALL_ACTIVITY = [
  {
    id: "demo-ca1",
    date: "Jul 12, 2023",
    extensionAgent: "Samantha Reed",
    type: "Cell",
    duration: "4:32",
    outcome: "Completed",
    direction: "Inbound",
    status: "Active",
    statusTone: "green" as const,
  },
  {
    id: "demo-ca2",
    date: "Jul 11, 2023",
    extensionAgent: "Jerome Bell",
    type: "Landline",
    duration: "2:18",
    outcome: "Completed",
    direction: "Outbound",
    status: "Active",
    statusTone: "green" as const,
  },
  {
    id: "demo-ca3",
    date: "Jul 10, 2023",
    extensionAgent: "Albert Flores",
    type: "VoIP",
    duration: "6:05",
    outcome: "Missed",
    direction: "Inbound",
    status: "Pending",
    statusTone: "orange" as const,
  },
  {
    id: "demo-ca4",
    date: "Jul 09, 2023",
    extensionAgent: "Katherine Moss",
    type: "Cell",
    duration: "1:47",
    outcome: "Completed",
    direction: "Inbound",
    status: "Active",
    statusTone: "green" as const,
  },
];

export const WIREFRAME_OVERVIEW_TOP_EXTENSIONS = [
  { id: "demo-ext1", label: "Extension 101" },
  { id: "demo-ext2", label: "Extension 202" },
  { id: "demo-ext3", label: "Extension 303" },
];

export const WIREFRAME_OVERVIEW_ACTIVE_DEVICES = [
  { id: "demo-dev1", label: "Office Desk Phone", sub: "San Francisco, CA" },
  { id: "demo-dev2", label: "Mobile — Anthony", sub: "iOS Device" },
];

export const WIREFRAME_OVERVIEW_QUICK_NOTES = [
  { id: "demo-qn1", text: "Follow up on port request" },
  { id: "demo-qn2", text: "Update voicemail greeting" },
];

export const WIREFRAME_OVERVIEW_INVOICES_LIST = [
  { label: "May 2023", amount: "$12.45" },
  { label: "Apr 2023", amount: "$12.45" },
];

export const WIREFRAME_OVERVIEW_PENDING_DEPLOYMENTS = [
  { id: "demo-dep1", label: "SMS routing update", progress: 65 },
  { id: "demo-dep2", label: "Number provisioning", progress: 30 },
];

export const WIREFRAME_OVERVIEW_ACTIVE_NUMBERS_LIST = [
  {
    id: "demo-an1",
    phone: "+14555455555",
    label: "New Line Number",
  },
];

export const WIREFRAME_OVERVIEW_SERVICES = [
  { label: "Cloud Connect", online: true },
  { label: "SMS Messaging", online: true },
  { label: "Voice Analytics", online: true },
];

export const WIREFRAME_OVERVIEW_COMMUNICATIONS = [
  { phone: "+1 (415) 555-0199", at: "Jul 12, 2023 · 10:15 AM" },
  { phone: "+1 (703) 555-9202", at: "Jul 11, 2023 · 4:42 PM" },
  { phone: "+1 (571) 407-3615", at: "Jul 10, 2023 · 9:30 AM" },
];

export const WIREFRAME_OVERVIEW_RECENT_REPORTS = [
  { name: "Call Summary Report.pdf", size: "5.2 MB" },
  { name: "Usage Analytics Q2.pdf", size: "3.8 MB" },
];

export const WIREFRAME_OVERVIEW_CALL_STATUS = [
  { label: "Call Time", value: 72 },
  { label: "Average Wait Time", value: 28 },
];

