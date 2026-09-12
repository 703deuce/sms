export type PersonalVoicemailMessage = {
  id: string;
  callerNumber: string;
  /** Resolved contact name when available */
  callerDisplayName?: string | null;
  durationSec: number | null;
  createdAt: string;
  transcript?: string | null;
  transcriptEnglish?: string | null;
  summary?: string | null;
  internalNotes?: string | null;
  /** Canonical read flag from `voicemail_messages.is_read` */
  isRead: boolean;
  readAt?: string | null;
  boxId?: string;
};

export type VoicemailInboxSummary = {
  totalCount: number;
  unreadCount: number;
  minutesThisMonth: number;
};

export type PersonalVoicemailBox = {
  id: string;
  name: string;
  greetingText?: string | null;
  greetingUrl?: string | null;
  emailNotify?: string | null;
  secondaryEmailNotify?: string | null;
  smsNotifyE164?: string | null;
  transcriptionEnabled?: boolean;
};

export function mapVoicemailMessage(row: {
  id: string;
  fromE164?: string | null;
  durationSeconds?: number | null;
  createdAt: Date | string;
  transcriptText?: string | null;
  transcriptEnglish?: string | null;
  aiSummary?: string | null;
  internalNotes?: string | null;
  isRead?: boolean;
  boxId?: string;
  callerDisplayName?: string | null;
}): PersonalVoicemailMessage {
  const isRead = Boolean(row.isRead);
  const durationRaw = row.durationSeconds;
  return {
    id: row.id,
    callerNumber: row.fromE164 || "Unknown",
    callerDisplayName: row.callerDisplayName ?? null,
    durationSec: durationRaw == null ? null : durationRaw,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    transcript: row.transcriptText,
    transcriptEnglish: row.transcriptEnglish,
    summary: row.aiSummary,
    internalNotes: row.internalNotes,
    isRead,
    readAt: isRead ? new Date().toISOString() : null,
    boxId: row.boxId,
  };
}

export function parseVoicemailApiPayload(data: unknown): {
  boxes: PersonalVoicemailBox[];
  messages: PersonalVoicemailMessage[];
  summary: VoicemailInboxSummary;
} {
  const emptySummary: VoicemailInboxSummary = {
    totalCount: 0,
    unreadCount: 0,
    minutesThisMonth: 0,
  };
  if (!data || typeof data !== "object") {
    return { boxes: [], messages: [], summary: emptySummary };
  }

  const payload = data as {
    summary?: VoicemailInboxSummary;
    boxes?: PersonalVoicemailBox[];
    messages?: Array<{
      id: string;
      fromE164?: string | null;
      durationSeconds?: number | null;
      createdAt: string;
      transcriptText?: string | null;
      transcriptEnglish?: string | null;
      aiSummary?: string | null;
      internalNotes?: string | null;
      isRead?: boolean;
      boxId?: string;
      callerDisplayName?: string | null;
    }>;
  };

  const boxes = Array.isArray(payload.boxes) ? payload.boxes : [];
  const messages = Array.isArray(payload.messages)
    ? payload.messages.map((m) => mapVoicemailMessage(m))
    : [];
  const summary = payload.summary ?? {
    totalCount: messages.length,
    unreadCount: messages.filter((m) => !m.isRead).length,
    minutesThisMonth: 0,
  };

  return { boxes, messages, summary };
}
