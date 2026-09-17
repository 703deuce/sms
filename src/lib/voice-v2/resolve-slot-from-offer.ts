import type { VoiceV2Slot } from "./types";

function normalizeSpokenTime(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
    .trim();
}

/**
 * Map caller language ("10 o'clock", "10:00 AM") to a slot_id within the persisted offer set.
 */
export function resolveSelectedSlotIdFromOffer(
  slots: VoiceV2Slot[],
  raw: unknown,
): string | null {
  const direct = String(raw ?? "").trim();
  if (direct && slots.some((s) => s.slot_id === direct)) return direct;

  const spoken = normalizeSpokenTime(
    String(
      (typeof raw === "object" && raw && "spoken_label" in (raw as object)
        ? (raw as { spoken_label?: string }).spoken_label
        : null) ||
        (typeof raw === "object" && raw && "label" in (raw as object)
          ? (raw as { label?: string }).label
          : null) ||
        direct,
    ),
  );
  if (!spoken) return null;

  for (const slot of slots) {
    const labels = [
      slot.label,
      slot.spoken_label,
      slot.slot_id,
    ].filter(Boolean) as string[];
    for (const label of labels) {
      const n = normalizeSpokenTime(label);
      if (n === spoken || spoken.includes(n) || n.includes(spoken)) {
        return slot.slot_id;
      }
    }
  }

  const timeMatch = spoken.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    const hour12 = Number(timeMatch[1]);
    const minute = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const ampm = (timeMatch[3] || "").toLowerCase();
    for (const slot of slots) {
      const labels = [slot.label, slot.spoken_label].filter(Boolean) as string[];
      for (const label of labels) {
        const n = normalizeSpokenTime(label);
        const labelMatch = n.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (!labelMatch) continue;
        const lh = Number(labelMatch[1]);
        const lm = labelMatch[2] ? Number(labelMatch[2]) : 0;
        const lampm = (labelMatch[3] || "").toLowerCase();
        if (lh === hour12 && lm === minute) {
          if (!ampm || !lampm || ampm === lampm) return slot.slot_id;
        }
      }
    }
  }

  return null;
}
