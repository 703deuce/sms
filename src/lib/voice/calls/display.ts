import type { MockCallOutcome } from "./mock-data";

export type CallOutcomeBadge =
  | "New Lead"
  | "Message Taken"
  | "Appointment Booked"
  | "Transferred"
  | "FAQ"
  | "Information Provided"
  | "Completed"
  | "Spam"
  | "No Action"
  | "Resolved"
  | "Lead Captured"
  | "Voice"
  | "Voicemail"
  | "No Answer";

export type CallListFilter =
  | "all"
  | "leads"
  | "appointments"
  | "messages"
  | "transferred"
  | "voicemails"
  | "no_answer";

export type CallRowLike = {
  outcome?: string | null;
  appointmentBooked?: boolean;
  transferred?: boolean;
  voicemailDetected?: boolean;
  isLead?: boolean | null;
  leadScore?: number | null;
  status?: string;
  summary?: string | null;
  intent?: string | null;
  mockOutcome?: MockCallOutcome | string | null;
};

export function fmtCallDuration(sec?: number | null): string {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Table duration format: 02:45 */
export function fmtCallDurationTable(sec?: number | null): string {
  if (sec == null || sec <= 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtCallDurationShort(sec?: number | null): string {
  if (sec == null || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function fmtCallPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return e164;
}

export function fmtCallDateTime(iso: string): { primary: string; secondary: string } {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) {
    return { primary: "Today", secondary: time };
  }
  if (d.toDateString() === yesterday.toDateString()) {
    return { primary: "Yesterday", secondary: time };
  }
  return {
    primary: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    secondary: time,
  };
}

export function fmtCallDateTable(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

export function deriveCallOutcomeBadge(call: CallRowLike): CallOutcomeBadge {
  if (call.mockOutcome) {
    const m = String(call.mockOutcome);
    if (m === "Lead Captured") return "Lead Captured";
    if (m === "Resolved") return "Resolved";
    if (m === "Voice") return "Voice";
    if (m === "Voicemail") return "Voicemail";
    if (m === "No Answer") return "No Answer";
    if (m === "Appointment Booked") return "Appointment Booked";
    if (m === "Message Taken") return "Message Taken";
    if (m === "Transferred") return "Transferred";
  }
  if (call.voicemailDetected) return "Voicemail";
  if (call.transferred) return "Transferred";
  if (call.appointmentBooked) return "Appointment Booked";
  const outcome = String(call.outcome || "").toLowerCase();
  if (outcome.includes("spam")) return "Spam";
  if (outcome.includes("appointment") || outcome.includes("booked")) {
    return "Appointment Booked";
  }
  if (
    outcome.includes("message") ||
    outcome.includes("callback") ||
    outcome.includes("follow_up")
  ) {
    return "Message Taken";
  }
  if (
    call.isLead ||
    (call.leadScore != null && call.leadScore >= 40) ||
    outcome.includes("lead")
  ) {
    return "New Lead";
  }
  if (outcome.includes("faq") || outcome.includes("information")) {
    return outcome.includes("information") ? "Information Provided" : "FAQ";
  }
  if (outcome.includes("no_answer") || call.status === "NO_ANSWER") return "No Answer";
  if (outcome.includes("completed") || call.status === "COMPLETED") {
    return "Resolved";
  }
  if (!outcome || outcome === "no_action" || outcome === "none") {
    return "No Action";
  }
  return "Completed";
}

export const OUTCOME_BADGE_STYLES: Record<CallOutcomeBadge, string> = {
  "New Lead": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Lead Captured": "bg-violet-50 text-violet-700 ring-violet-200",
  "Message Taken": "bg-sky-50 text-sky-700 ring-sky-200",
  "Appointment Booked": "bg-amber-50 text-amber-800 ring-amber-200",
  Transferred: "bg-violet-50 text-violet-700 ring-violet-200",
  FAQ: "bg-slate-100 text-slate-700 ring-slate-200",
  "Information Provided": "bg-orange-50 text-orange-800 ring-orange-200",
  Completed: "bg-primary/10 text-primary ring-primary/20",
  Resolved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Voice: "bg-slate-100 text-slate-600 ring-slate-200",
  Voicemail: "bg-slate-100 text-slate-600 ring-slate-200",
  Spam: "bg-rose-50 text-rose-700 ring-rose-200",
  "No Action": "bg-slate-100 text-slate-600 ring-slate-200",
  "No Answer": "bg-slate-100 text-slate-600 ring-slate-200",
};

export function filterMatchesOutcome(filter: CallListFilter, call: CallRowLike): boolean {
  if (filter === "all") return true;
  const badge = deriveCallOutcomeBadge(call);
  if (filter === "leads")
    return badge === "New Lead" || badge === "Lead Captured";
  if (filter === "appointments") return badge === "Appointment Booked";
  if (filter === "messages") return badge === "Message Taken";
  if (filter === "transferred") return badge === "Transferred";
  if (filter === "voicemails") return badge === "Voicemail";
  if (filter === "no_answer") return badge === "No Answer" || badge === "No Action";
  return true;
}

export function fmtTalkTime(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}
