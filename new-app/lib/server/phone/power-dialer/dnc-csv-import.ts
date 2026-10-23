import { parseCsvText } from "./csv-import";
import { addInternalDnc } from "./internal-dnc";
import { normalizeE164 } from "@/lib/server/phone/normalize";

export async function importDncCsv(input: {
  workspaceId: string;
  csvText: string;
  actorUserId?: string | null;
}) {
  const { rows } = parseCsvText(input.csvText);
  let added = 0;
  let skipped = 0;
  let invalid = 0;
  const errors: { line: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const lineNumber = i + 2;
    const row = rows[i];
    const phoneCell =
      row.phone ||
      row.Phone ||
      row.number ||
      row.Number ||
      Object.values(row).find((v) => typeof v === "string" && v.replace(/\D/g, "").length >= 10);
    if (!phoneCell || typeof phoneCell !== "string") {
      invalid += 1;
      errors.push({ line: lineNumber, reason: "No phone column" });
      continue;
    }
    try {
      const phone = normalizeE164(phoneCell);
      await addInternalDnc({
        workspaceId: input.workspaceId,
        phone,
        reason: typeof row.reason === "string" ? row.reason : "CSV import",
        source: "csv",
        actorUserId: input.actorUserId,
      });
      added += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid";
      if (/duplicate|unique/i.test(msg)) skipped += 1;
      else {
        invalid += 1;
        errors.push({ line: lineNumber, reason: msg });
      }
    }
  }

  return { added, skipped, invalid, errors: errors.slice(0, 50) };
}
