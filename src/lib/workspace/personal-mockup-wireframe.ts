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
    ringDurationSeconds: 12,
    durationSeconds: 154,
    date: "May 15, 2026",
    time: "3:42 PM",
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
  forwardedMinutes: 542,
  avgDurationSec: 154,
  trends: { total: 12.4, answered: 68.2, missed: -6.8, voicemails: 8.7, forwarded: 15.6, avgDuration: 7.3 },
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
    durationSec: 38,
    transcript:
      "Hi, this is John Smith. I was calling about the listing on Maple Street. Please call me back when you get a chance. Thanks.",
    readAt: null,
    createdAt: "2026-05-15T15:42:00",
    isDemo: true,
  },
  {
    id: "demo-vm2",
    callerName: "Sarah Chen",
    callerNumber: "+12025550199",
    durationSec: 22,
    transcript: "Just checking in on our appointment tomorrow. Let me know if the time still works.",
    readAt: "2026-05-14T10:00:00",
    createdAt: "2026-05-14T11:18:00",
    isDemo: true,
  },
  {
    id: "demo-vm3",
    callerName: "Unknown",
    callerNumber: "+17035559202",
    durationSec: 15,
    transcript: "Please return my call regarding the property inquiry.",
    readAt: "2026-05-13T08:30:00",
    createdAt: "2026-05-13T09:05:00",
    isDemo: true,
  },
];

export const WIREFRAME_VOICEMAIL_KPIS = {
  total: 42,
  unread: 6,
  minutes: 38,
};
