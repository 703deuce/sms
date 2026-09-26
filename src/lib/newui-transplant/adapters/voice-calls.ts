import type { CallOutcome, VoiceCall } from "@/newui-transplant/lib/view-models";
import {
  fmtCallDateTable,
  fmtCallDurationTable,
  fmtCallPhone,
} from "@/lib/voice/calls/display";
import { deriveCallListOutcomeDisplay } from "@/lib/voice/calls/outcome-display";

export type VoiceCallApiRow = {
  id: string;
  direction: string;
  fromE164: string;
  toE164: string;
  startedAt: string;
  durationSeconds?: number | null;
  contactName?: string | null;
  summary?: string | null;
  appointmentBooked?: boolean;
  transferred?: boolean;
  voicemailDetected?: boolean;
  leadScore?: number | null;
  status?: string;
  outcome?: string | null;
  recordings?: { id: string }[];
};

function primaryToCallOutcome(primary: string): CallOutcome {
  const p = primary.toLowerCase();
  if (p.includes("appointment") || p.includes("booked")) return "Appointment";
  if (p.includes("lead")) return "Lead";
  if (p.includes("transfer")) return "Transfer";
  if (p.includes("voicemail")) return "Voicemail";
  if (p.includes("message") || p.includes("callback")) return "Message";
  if (p.includes("no answer") || p.includes("no action")) return "No Answer";
  return "Message";
}

export function mapVoiceCallApiRowToNewUi(row: VoiceCallApiRow): VoiceCall {
  const phone = fmtCallPhone(row.direction === "INBOUND" ? row.fromE164 : row.toE164);
  const caller = row.contactName?.trim() || phone;
  const { date, time } = fmtCallDateTable(row.startedAt);
  const display = deriveCallListOutcomeDisplay(row);
  const attention = display.attention ?? undefined;

  return {
    id: row.id,
    caller,
    phone,
    date,
    time,
    duration: fmtCallDurationTable(row.durationSeconds),
    outcome: primaryToCallOutcome(display.primary),
    attention,
    recording: Boolean(row.recordings?.length),
    summary: row.summary?.trim() || "—",
  };
}
