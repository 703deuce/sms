const ISO_LIKE = /^\d{4}-\d{2}-\d{2}T/;

export function buildArSmsOutcomeDetail(input: {
  reminderTimelineType: string;
  note?: string;
  newStartsAtIso?: string;
}): string {
  const parts = [input.reminderTimelineType || "unknown_reminder"];
  if (input.note?.trim()) parts.push(input.note.trim());
  if (input.newStartsAtIso?.trim()) parts.push(input.newStartsAtIso.trim());
  return parts.join(" | ");
}

export function parseArSmsOutcomeDetail(detail?: string | null): {
  reminderTimelineType: string;
  note?: string;
  newStartsAtIso?: string;
} {
  if (!detail?.trim()) {
    return { reminderTimelineType: "unknown_reminder" };
  }
  const parts = detail.split("|").map((p) => p.trim()).filter(Boolean);
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
