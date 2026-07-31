import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export type ValidationRow = {
  phone: string;
  normalized?: string;
  status: "valid" | "invalid" | "landline" | "duplicate";
  reason?: string;
  carrier?: string;
};

/** Heuristic validation without carrier API — normalizes, dedupes, flags obvious landlines */
export function validatePhoneBatch(phones: string[]): ValidationRow[] {
  const seen = new Set<string>();
  const rows: ValidationRow[] = [];

  for (const raw of phones) {
    const trimmed = String(raw || "").trim();
    if (!trimmed) {
      rows.push({ phone: raw, status: "invalid", reason: "empty" });
      continue;
    }
    try {
      const normalized = normalizeE164(trimmed);
      if (seen.has(normalized)) {
        rows.push({ phone: trimmed, normalized, status: "duplicate", reason: "duplicate in batch" });
        continue;
      }
      seen.add(normalized);

      // US toll-free and landline heuristics (not carrier-grade)
      const isTollFree = /^\+1(800|888|877|866|855|844|833)/.test(normalized);
      const isLandlinePattern = /^\+1[2-9]\d{2}[2-5]\d{6}$/.test(normalized) && !isTollFree;

      rows.push({
        phone: trimmed,
        normalized,
        status: isLandlinePattern ? "landline" : "valid",
        reason: isLandlinePattern ? "possible landline — SMS delivery may fail" : undefined,
        carrier: isLandlinePattern ? "landline (heuristic)" : "mobile (assumed)",
      });
    } catch {
      rows.push({ phone: trimmed, status: "invalid", reason: "invalid E.164" });
    }
  }

  return rows;
}

export async function validateWorkspaceContacts(workspaceId: string, phones?: string[]) {
  const prisma = getPrisma();
  let inputPhones = phones;
  if (!inputPhones?.length) {
    const contacts = await prisma.contact.findMany({
      where: { workspaceId },
      select: { phone: true },
    });
    inputPhones = contacts.map((c: { phone: string }) => c.phone);
  }

  const results = validatePhoneBatch(inputPhones ?? []);
  const valid = results.filter((r) => r.status === "valid").length;
  const invalid = results.filter((r) => r.status === "invalid").length;
  const landline = results.filter((r) => r.status === "landline").length;
  const duplicate = results.filter((r) => r.status === "duplicate").length;

  return {
    total: results.length,
    valid,
    invalid,
    landline,
    duplicate,
    estimatedSavingsCents: (invalid + landline + duplicate) * 15,
    rows: results,
  };
}

export async function markInvalidContacts(workspaceId: string, phones: string[]) {
  const prisma = getPrisma();
  let updated = 0;
  for (const phone of phones) {
    try {
      const e164 = normalizeE164(phone);
      const row = await prisma.contact.updateMany({
        where: { workspaceId, phone: e164 },
        data: { status: "INVALID" },
      });
      updated += row.count;
    } catch {
      // skip
    }
  }
  return { updated };
}
