export type PersonalVoicemailMessage = {
  id: string;
  callerNumber: string;
  durationSec: number;
  createdAt: string;
  transcript?: string | null;
  internalNotes?: string | null;
  readAt?: string | null;
  boxId?: string;
};

export type PersonalVoicemailBox = {
  id: string;
  name: string;
  greetingText?: string | null;
  greetingUrl?: string | null;
  emailNotify?: string | null;
  secondaryEmailNotify?: string | null;
  transcriptionEnabled?: boolean;
};

export function mapVoicemailMessage(row: {
  id: string;
  fromE164?: string | null;
  durationSeconds?: number | null;
  createdAt: Date | string;
  transcriptText?: string | null;
  internalNotes?: string | null;
  isRead?: boolean;
  boxId?: string;
}): PersonalVoicemailMessage {
  return {
    id: row.id,
    callerNumber: row.fromE164 || "Unknown",
    durationSec: row.durationSeconds ?? 0,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    transcript: row.transcriptText,
    internalNotes: row.internalNotes,
    readAt: row.isRead ? new Date().toISOString() : null,
    boxId: row.boxId,
  };
}

export function parseVoicemailApiPayload(data: unknown): {
  boxes: PersonalVoicemailBox[];
  messages: PersonalVoicemailMessage[];
} {
  if (!data || typeof data !== "object") {
    return { boxes: [], messages: [] };
  }

  const payload = data as {
    boxes?: PersonalVoicemailBox[];
    messages?: Array<{
      id: string;
      fromE164?: string | null;
      durationSeconds?: number | null;
      createdAt: string;
      transcriptText?: string | null;
      internalNotes?: string | null;
      isRead?: boolean;
      boxId?: string;
    }>;
  };

  const boxes = Array.isArray(payload.boxes) ? payload.boxes : [];
  const messages = Array.isArray(payload.messages)
    ? payload.messages.map((m) => mapVoicemailMessage(m))
    : [];

  return { boxes, messages };
}
