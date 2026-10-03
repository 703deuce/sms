import type { VoicemailItem } from "@/newui-transplant/lib/view-models";
import type { PersonalVoicemailMessage } from "@/lib/personal/voicemail-mappers";
import { formatPhone } from "@/lib/utils";

export type VoicemailApiMessage = {
  id: string;
  fromE164?: string | null;
  contactName?: string | null;
  durationSeconds?: number | null;
  createdAt: string;
  isRead?: boolean;
  aiSummary?: string | null;
  transcript?: string | null;
  hasRecording?: boolean;
  conversationId?: string | null;
};

export function mapPersonalVoicemailToMctbApi(row: PersonalVoicemailMessage): VoicemailApiMessage {
  return {
    id: row.id,
    fromE164: row.callerNumber,
    contactName: row.callerDisplayName,
    durationSeconds: row.durationSec,
    createdAt: row.createdAt,
    isRead: row.isRead,
    aiSummary: row.summary,
    transcript: row.transcript,
    hasRecording: row.hasRecording,
  };
}

export function mapVoicemailApiToNewUi(row: VoicemailApiMessage): VoicemailItem {
  const phone = row.fromE164 ? formatPhone(row.fromE164) : "—";
  const caller = row.contactName?.trim() || phone;
  const durationSec = row.durationSeconds ?? 0;
  const m = Math.floor(durationSec / 60);
  const s = durationSec % 60;
  return {
    id: row.id,
    caller,
    phone,
    isNew: !row.isRead,
    time: new Date(row.createdAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    duration: `${m}:${String(s).padStart(2, "0")}`,
    summary: row.aiSummary?.trim() || "No summary yet",
    transcript: row.transcript?.trim() || null,
    recordingSrc: row.hasRecording ? `/api/phone/voicemail/${row.id}/recording` : undefined,
    conversationHref: row.conversationId
      ? `/mctb/conversations?conversation=${row.conversationId}`
      : undefined,
  };
}
