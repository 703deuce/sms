/** Weak one-word answers that need explicit confirmation for access / gate-code fields. */
const WEAK_ACCESS_NOTE_TOKENS = new Set([
  "none",
  "n/a",
  "na",
  "no",
  "nothing",
  "nil",
  "null",
]);

function isAccessNotesField(fieldId: string): boolean {
  const id = fieldId.toLowerCase();
  return id.includes("access") || id.includes("gate") || id.includes("entry");
}

export function validateBookingNotesField(
  fieldId: string,
  raw: string,
): { ok: true; normalized: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: "Please share any gate codes or access notes, or say there are none." };
  }

  if (!isAccessNotesField(fieldId)) {
    return { ok: true, normalized: trimmed };
  }

  const token = trimmed.toLowerCase().replace(/[.,!?]/g, "").trim();
  if (WEAK_ACCESS_NOTE_TOKENS.has(token)) {
    return {
      ok: false,
      message:
        "Just to confirm — no gate codes or special access instructions for the technician?",
    };
  }

  return { ok: true, normalized: trimmed };
}
