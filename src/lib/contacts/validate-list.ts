import { getPrisma } from "@/lib/db";
import { visibleContactWhere } from "@/lib/contacts/visible-contacts";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";

export type ValidationRow = {
  phone: string;
  normalized?: string;
  status: "valid" | "invalid" | "landline" | "duplicate";
  reason?: string;
  carrier?: string;
};

type TelnyxLookupData = {
  carrier?: { name?: string; type?: string; error_code?: string | null };
  phone_number?: string;
};

async function lookupTelnyxCarrier(normalized: string): Promise<{
  carrier?: string;
  lineType?: string;
} | null> {
  const apiKey = getTelnyxApiKey();
  if (!apiKey) return null;

  try {
    const encoded = encodeURIComponent(normalized);
    const res = await telnyxRequest<{ data: TelnyxLookupData }>(
      `/number_lookup/${encoded}`,
      { query: { type: "carrier" } },
    );
    const carrier = res.data?.carrier;
    if (!carrier) return null;
    return {
      carrier: carrier.name || undefined,
      lineType: carrier.type || undefined,
    };
  } catch {
    return null;
  }
}

function heuristicRow(trimmed: string, normalized: string): ValidationRow {
  const isTollFree = /^\+1(800|888|877|866|855|844|833)/.test(normalized);
  const isLandlinePattern =
    /^\+1[2-9]\d{2}[2-5]\d{6}$/.test(normalized) && !isTollFree;

  return {
    phone: trimmed,
    normalized,
    status: isLandlinePattern ? "landline" : "valid",
    reason: isLandlinePattern ? "possible landline — SMS delivery may fail" : undefined,
    carrier: isLandlinePattern ? "landline (heuristic)" : "mobile (assumed)",
  };
}

/** Validate phones — uses Telnyx Number Lookup when TELNYX_API_KEY is set. */
export async function validatePhoneBatch(phones: string[]): Promise<ValidationRow[]> {
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

      const lookup = await lookupTelnyxCarrier(normalized);
      if (lookup) {
        const lineType = (lookup.lineType || "").toLowerCase();
        const isLandline =
          lineType === "landline" ||
          lineType === "fixed" ||
          lineType === "fixed_line";
        const isInvalid = lineType === "invalid" || lineType === "unknown";

        rows.push({
          phone: trimmed,
          normalized,
          status: isInvalid ? "invalid" : isLandline ? "landline" : "valid",
          reason: isLandline
            ? "landline — SMS delivery may fail"
            : isInvalid
              ? "invalid number type"
              : undefined,
          carrier: lookup.carrier
            ? `${lookup.carrier} (${lookup.lineType || "unknown"})`
            : lookup.lineType || undefined,
        });
      } else {
        rows.push(heuristicRow(trimmed, normalized));
      }
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
      where: visibleContactWhere(workspaceId),
      select: { phone: true },
    });
    inputPhones = contacts.map((c: { phone: string }) => c.phone);
  }

  const results = await validatePhoneBatch(inputPhones ?? []);
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
        where: { ...visibleContactWhere(workspaceId), phone: e164 },
        data: { status: "INVALID" },
      });
      updated += row.count;
    } catch {
      // skip
    }
  }
  return { updated };
}
