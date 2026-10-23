import { normalizeE164 } from "@/lib/server/phone/normalize";
import { inferTimezoneFromAreaCode } from "./timezone-infer";

export type CsvRow = Record<string, string>;

export type ColumnMapping = {
  name?: string;
  phone?: string;
  mobile?: string;
  work?: string;
  company?: string;
  email?: string;
  title?: string;
  timezone?: string;
  custom: Record<string, string>;
};

export type ParsedImportRow = {
  lineNumber: number;
  name?: string;
  phones: { field: string; raw: string; e164: string | null; priority?: number }[];
  company?: string;
  email?: string;
  title?: string;
  timezone?: string;
  timezoneInferred?: boolean;
  customFields: Record<string, string>;
  errors: string[];
  raw?: CsvRow;
};

export type DuplicateKey = string;

export function parseCsvText(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function mapCsvRows(
  rows: CsvRow[],
  mapping: ColumnMapping,
  defaultCountry: string = "US",
): ParsedImportRow[] {
  return rows.map((row, idx) => {
    const lineNumber = idx + 2;
    const errors: string[] = [];
    const customFields: Record<string, string> = {};
    for (const [key, col] of Object.entries(mapping.custom)) {
      if (col && row[col]) customFields[key] = row[col];
    }

    const name = mapping.name && row[mapping.name] ? row[mapping.name] : undefined;
    const company = mapping.company && row[mapping.company] ? row[mapping.company] : undefined;
    const email = mapping.email && row[mapping.email] ? row[mapping.email] : undefined;
    const title = mapping.title && row[mapping.title] ? row[mapping.title] : undefined;
    let timezone = mapping.timezone && row[mapping.timezone] ? row[mapping.timezone] : undefined;
    let timezoneInferred = false;
    if (timezone && !/^[A-Za-z_]+\/[A-Za-z_]+/.test(timezone)) {
      errors.push("Invalid timezone — use IANA format (e.g. America/Chicago)");
      timezone = undefined;
    }

    const phoneCols: { field: string; col?: string }[] = [
      { field: "mobile", col: mapping.mobile },
      { field: "work", col: mapping.work },
      { field: "phone", col: mapping.phone },
    ].filter((p) => p.col);

    const phones: ParsedImportRow["phones"] = [];
    let priority = 0;
    for (const p of phoneCols) {
      const raw = p.col ? row[p.col] : "";
      if (!raw) continue;
      try {
        phones.push({ field: p.field, raw, e164: normalizeE164(raw), priority });
        priority += 1;
      } catch {
        phones.push({ field: p.field, raw, e164: null, priority });
        errors.push(`Invalid ${p.field} number`);
      }
    }

    if (!phones.length) errors.push("No phone mapped");

    if (!timezone && phones[0]?.e164) {
      const inferred = inferTimezoneFromAreaCode(phones[0].e164);
      if (inferred) {
        timezone = inferred;
        timezoneInferred = true;
      }
    }

    return {
      lineNumber,
      name,
      phones,
      company,
      email,
      title,
      timezone,
      timezoneInferred,
      customFields,
      errors,
      raw: row,
    };
  });
}

export function duplicateKeyFromE164(e164: string): DuplicateKey {
  return e164;
}

export function findDuplicatesInFile(parsed: ParsedImportRow[]): Map<DuplicateKey, number[]> {
  const map = new Map<DuplicateKey, number[]>();
  for (const row of parsed) {
    const primary = row.phones.find((p) => p.e164)?.e164;
    if (!primary) continue;
    const key = duplicateKeyFromE164(primary);
    const list = map.get(key) || [];
    list.push(row.lineNumber);
    map.set(key, list);
  }
  const dupes = new Map<DuplicateKey, number[]>();
  for (const [k, lines] of map) {
    if (lines.length > 1) dupes.set(k, lines);
  }
  return dupes;
}
