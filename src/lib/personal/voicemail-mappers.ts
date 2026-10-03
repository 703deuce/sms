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
  hasRecording?: boolean;
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
  hasRecording?: boolean;
  durationSec?: number | null;
  callerNumber?: string;
  transcript?: string | null;
}): PersonalVoicemailMessage {
  const isRead = Boolean(row.isRead);
  const durationRaw =
    row.durationSeconds ??
    row.durationSec ??
    null;
  const durationSec =
    durationRaw == null || durationRaw <= 0 ? null : durationRaw;
  const callerNumber =
    row.callerNumber ||
    row.fromE164 ||
    "Unknown";
  return {
    id: row.id,
    callerNumber,
    callerDisplayName: row.callerDisplayName ?? null,
    durationSec,
    hasRecording: row.hasRecording,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    transcript: row.transcript ?? row.transcriptText,
    transcriptEnglish: row.transcriptEnglish,
    summary: row.aiSummary,
    internalNotes: row.internalNotes,
    isRead,
    readAt: isRead ? new Date().toISOString() : null,
    boxId: row.boxId,
  };
}

/** Accept either `{ data: { boxes, messages } }` (session API routes) or the inner payload. */
export function unwrapVoicemailApiEnvelope(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const record = data as Record<string, unknown>;
  const inner = record.data;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    const innerRecord = inner as Record<string, unknown>;
    if ("messages" in innerRecord || "boxes" in innerRecord || "summary" in innerRecord) {
      return inner;
    }
  }
  return data;
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
  const unwrapped = unwrapVoicemailApiEnvelope(data);
  if (!unwrapped || typeof unwrapped !== "object") {
    return { boxes: [], messages: [], summary: emptySummary };
  }

  const payload = unwrapped as {
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
    ? payload.messages.map((m) => {
        const row = m as Record<string, unknown>;
        if (row.callerNumber != null && typeof row.isRead === "boolean") {
          return mapVoicemailMessage({
            id: String(row.id),
            callerNumber: String(row.callerNumber),
            callerDisplayName: row.callerDisplayName as string | null,
            durationSec: row.durationSec as number | null,
            durationSeconds: row.durationSeconds as number | null,
            createdAt: String(row.createdAt),
            transcript: row.transcript as string | null,
            transcriptEnglish: row.transcriptEnglish as string | null,
            aiSummary: (row.summary ?? row.aiSummary) as string | null,
            internalNotes: row.internalNotes as string | null,
            isRead: row.isRead as boolean,
            boxId: row.boxId as string | undefined,
            hasRecording: row.hasRecording as boolean | undefined,
          });
        }
        return mapVoicemailMessage(m);
      })
    : [];
  const summary =
    payload.summary &&
    typeof payload.summary.totalCount === "number" &&
    typeof payload.summary.unreadCount === "number"
      ? payload.summary
      : emptySummary;

  return { boxes, messages, summary };
}
