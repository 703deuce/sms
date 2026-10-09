/** Advisory Context Agent output — plain language only; not authoritative over conversation or calendar state. */
export type ArSmsContextNotes = string;

export const AR_SMS_CONTEXT_NOTES_HEADER = "CONTEXT AGENT NOTES";

const MAX_NOTES_CHARS = 4000;

export function normalizeArSmsContextNotes(raw: string): ArSmsContextNotes {
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallbackArSmsContextNotes("empty_context_agent_output");
  }
  const withoutFence = trimmed.replace(/^```(?:markdown|text)?\s*/i, "").replace(/\s*```$/i, "");
  let notes = withoutFence.trim();
  if (!notes.toUpperCase().includes(AR_SMS_CONTEXT_NOTES_HEADER)) {
    notes = `${AR_SMS_CONTEXT_NOTES_HEADER}\n\n${notes}`;
  }
  if (notes.length > MAX_NOTES_CHARS) {
    notes = `${notes.slice(0, MAX_NOTES_CHARS - 1)}…`;
  }
  return notes;
}

export function fallbackArSmsContextNotes(reason: string): ArSmsContextNotes {
  return normalizeArSmsContextNotes(
    `${AR_SMS_CONTEXT_NOTES_HEADER}\n\nContext interpretation unavailable (${reason}). The Appointment Agent should rely on the original conversation messages and authoritative appointment state.`,
  );
}

/** Legacy workflow blobs may still store structured interpretation objects. */
export function contextNotesFromPersistedWorkflow(raw: unknown): ArSmsContextNotes | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.lastContextNotes === "string" && o.lastContextNotes.trim()) {
    return o.lastContextNotes;
  }
  const legacy = o.lastContextInterpretation;
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    const rel = (legacy as { relevant_context?: string }).relevant_context;
    if (typeof rel === "string" && rel.trim()) {
      return normalizeArSmsContextNotes(rel);
    }
  }
  return undefined;
}
