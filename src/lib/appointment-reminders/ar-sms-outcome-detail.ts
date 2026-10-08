const ISO_LIKE = /^\d{4}-\d{2}-\d{2}T/;

/** Structured evidence stored in timeline `detail` (JSON). Legacy rows use pipe format. */
export type ArSmsOutcomeEvidence = {
  v: 1;
  reminderTimelineType?: string;
  note?: string;
  newStartsAtIso?: string;
  channel?: "sms";
  direction?: "inbound" | "outbound";
  messageText?: string;
  providerMessageId?: string;
  operationId?: string;
  policyFingerprint?: string;
  policyCutoffMinutes?: number;
  policyAfterCutoff?: string;
  penaltyType?: string;
  consequenceLabel?: string;
  calendarResult?: "verified" | "failed" | "uncertain";
  action?: "cancel" | "reschedule";
};

export type ParsedArSmsOutcomeDetail = {
  reminderTimelineType: string;
  note?: string;
  newStartsAtIso?: string;
  evidence?: ArSmsOutcomeEvidence;
};

export function serializeArSmsOutcomeDetail(evidence: ArSmsOutcomeEvidence): string {
  return JSON.stringify(evidence);
}

export function parseArSmsOutcomeDetail(detail?: string | null): ParsedArSmsOutcomeDetail {
  if (!detail?.trim()) {
    return { reminderTimelineType: "unknown_reminder" };
  }
  const trimmed = detail.trim();
  if (trimmed.startsWith("{")) {
    try {
      const raw = JSON.parse(trimmed) as ArSmsOutcomeEvidence;
      if (raw?.v === 1) {
        return {
          reminderTimelineType: raw.reminderTimelineType || "unknown_reminder",
          note: raw.note,
          newStartsAtIso: raw.newStartsAtIso,
          evidence: raw,
        };
      }
    } catch {
      /* fall through to legacy */
    }
  }

  const parts = trimmed.split("|").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return { reminderTimelineType: "unknown_reminder" };

  let newStartsAtIso: string | undefined;
  const last = parts[parts.length - 1];
  if (last && ISO_LIKE.test(last)) {
    newStartsAtIso = last;
    parts.pop();
  }

  const reminderTimelineType = parts[0] || "unknown_reminder";
  const note = parts.length > 1 ? parts.slice(1).join(" | ") : undefined;
  return { reminderTimelineType, note, newStartsAtIso };
}

export function buildArSmsOutcomeDetail(input: {
  reminderTimelineType: string;
  note?: string;
  newStartsAtIso?: string;
  evidence?: Omit<ArSmsOutcomeEvidence, "v" | "reminderTimelineType" | "note" | "newStartsAtIso">;
}): string {
  if (input.evidence && Object.keys(input.evidence).length > 0) {
    const payload: ArSmsOutcomeEvidence = {
      v: 1,
      reminderTimelineType: input.reminderTimelineType || "unknown_reminder",
      note: input.note?.trim() || undefined,
      newStartsAtIso: input.newStartsAtIso?.trim() || undefined,
      ...input.evidence,
    };
    return serializeArSmsOutcomeDetail(payload);
  }
  const parts = [input.reminderTimelineType || "unknown_reminder"];
  if (input.note?.trim()) parts.push(input.note.trim());
  if (input.newStartsAtIso?.trim()) parts.push(input.newStartsAtIso.trim());
  return parts.join(" | ");
}
