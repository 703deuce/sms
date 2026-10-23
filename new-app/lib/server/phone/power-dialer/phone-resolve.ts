import { normalizeE164 } from "@/lib/server/phone/normalize";
import type { ContactForEligibility } from "./types";

export function resolveContactDialPhone(
  contact: ContactForEligibility,
  priority: string[],
): { e164: string | null; field: string | null } {
  const custom =
    contact.customFields && typeof contact.customFields === "object"
      ? (contact.customFields as Record<string, unknown>)
      : {};

  const extraPhones = (contact.phones || [])
    .filter((p) => !p.outcome || p.outcome === "retry")
    .sort((a, b) => a.priority - b.priority);
  const preferredExtra = extraPhones.find((p) => p.isPreferred) || extraPhones[0];
  if (preferredExtra?.e164 && priority.includes("phones")) {
    try {
      return { e164: normalizeE164(preferredExtra.e164), field: "phones" };
    } catch {
      /* fall through */
    }
  }

  for (const field of priority) {
    if (field === "phone") {
      try {
        return { e164: normalizeE164(contact.phone), field: "phone" };
      } catch {
        continue;
      }
    }
    const raw = custom[field];
    if (typeof raw === "string" && raw.trim()) {
      try {
        return { e164: normalizeE164(raw), field };
      } catch {
        continue;
      }
    }
  }
  try {
    return { e164: normalizeE164(contact.phone), field: "phone" };
  } catch {
    return { e164: null, field: null };
  }
}
