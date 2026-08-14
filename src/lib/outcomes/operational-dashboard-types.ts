export type DashboardDateRange = "today" | "7d" | "30d";

export type AttentionTone = "red" | "yellow" | "green";

export type CallDisposition = "answered" | "voicemail" | "missed";

export type OperationalDashboardData = {
  greeting: string;
  userName: string;
  dateRange: DashboardDateRange;
  receptionist: {
    name: string;
    active: boolean;
    phoneDisplay: string;
    editHref: string;
    testHref: string;
  };
  sms: {
    ready: boolean;
    label: string;
    sublabel: string;
    detail: string;
  };
  kpis: {
    callsAnswered: number;
    callsAnsweredChangePct: number | null;
    newLeads: number;
    newLeadsChangePct: number | null;
    appointmentsBooked: number;
    appointmentsChangePct: number | null;
    messagesTaken: number;
    messagesChangePct: number | null;
  };
  chart: {
    days: Array<{
      label: string;
      answered: number;
      voicemail: number;
      missed: number;
    }>;
  };
  attention: Array<{
    id: string;
    tone: AttentionTone;
    title: string;
    body?: string;
    actionLabel: string;
    href: string;
  }>;
  recentCalls: Array<{
    id: string;
    name: string;
    initials: string;
    reason: string;
    disposition: CallDisposition;
    duration: string;
    timeLabel: string;
    href: string;
    hasRecording: boolean;
  }>;
  smsPanel: {
    sent: number;
    replies: number;
    messagesUsed: number;
    messagesLimit: number;
    messagesPct: number;
    campaign?: {
      name: string;
      endsLabel?: string;
      href: string;
    };
    empty?: { title: string; body: string; actionLabel: string; href: string };
  };
  automationsPanel: {
    activeCount: number;
    flows: Array<{ name: string; active: boolean }>;
    href: string;
  };
  planUsage: {
    receptionistMinutesUsed: number;
    receptionistMinutesLimit: number;
    receptionistPct: number;
    smsMessagesUsed: number;
    smsMessagesLimit: number;
    smsPct: number;
    daysLeftInCycle: number;
  };
};

export function dispositionLabel(d: CallDisposition): string {
  if (d === "answered") return "Answered";
  if (d === "voicemail") return "Voicemail";
  return "Missed";
}
