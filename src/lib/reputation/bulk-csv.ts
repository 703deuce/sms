export const MAX_CSV_BYTES = 2_000_000;
export const MAX_CSV_COLUMNS = 40;
export const MAX_CELL_CHARS = 2000;

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvParseError";
  }
}

export type CsvMapTarget =
  | "ignore"
  | "first_name"
  | "last_name"
  | "full_name"
  | "phone"
  | "email"
  | "service_date"
  | "job_type"
  | "city"
  | "notes";

export const MAP_TARGET_LABELS: Record<CsvMapTarget, string> = {
  ignore: "Ignore",
  first_name: "First Name",
  last_name: "Last Name",
  full_name: "Full Name",
  phone: "Phone",
  email: "Email",
  service_date: "Service Date",
  job_type: "Job Type",
  city: "City",
  notes: "Notes",
};

export const CSV_TEMPLATE_HEADERS =
  "first_name,last_name,full_name,phone,email,service_date,job_type,city,notes";

const AUTO_MAP: Array<{ pattern: RegExp; target: CsvMapTarget }> = [
  { pattern: /^first[_\s-]?name$|^fname$/i, target: "first_name" },
  { pattern: /^last[_\s-]?name$|^lname$/i, target: "last_name" },
  { pattern: /^full[_\s-]?name$|^name$|^customer$|^customer[_\s-]?name$|^client$/i, target: "full_name" },
  { pattern: /^phone$|^phone[_\s-]?number$|^mobile$|^cell$|^cell[_\s-]?phone$|^telephone$/i, target: "phone" },
  { pattern: /^e-?mail$|^email[_\s-]?address$|^mail$/i, target: "email" },
  { pattern: /^service[_\s-]?date$|^job[_\s-]?date$|^completed[_\s-]?date$|^date$/i, target: "service_date" },
  { pattern: /^job[_\s-]?type$|^service$|^service[_\s-]?type$/i, target: "job_type" },
  { pattern: /^city$|^location$|^town$/i, target: "city" },
  { pattern: /^notes$|^memo$|^description$/i, target: "notes" },
];

export function autoDetectMapping(header: string): CsvMapTarget {
  const h = header.trim();
  for (const rule of AUTO_MAP) {
    if (rule.pattern.test(h)) return rule.target;
  }
  return "ignore";
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const byteLength = Buffer.byteLength(text, "utf8");
  if (byteLength > MAX_CSV_BYTES) {
    throw new CsvParseError(`CSV exceeds maximum size of ${MAX_CSV_BYTES} bytes`);
  }

  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      if (current.trim() || lines.length) lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim() || lines.length) lines.push(current);

  const parsed = lines
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const fields: string[] = [];
      let field = "";
      let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];
        if (ch === '"') {
          if (quoted && next === '"') {
            field += '"';
            i++;
          } else {
            quoted = !quoted;
          }
        } else if (ch === "," && !quoted) {
          fields.push(field.trim());
          field = "";
        } else {
          field += ch;
        }
      }
      fields.push(field.trim());
      return fields;
    });

  if (!parsed.length) return { headers: [], rows: [] };
  const headers = parsed[0].map((h) => h.replace(/^\uFEFF/, ""));
  if (headers.length > MAX_CSV_COLUMNS) {
    throw new CsvParseError(`CSV exceeds maximum of ${MAX_CSV_COLUMNS} columns`);
  }
  for (const row of parsed) {
    for (const cell of row) {
      if (cell.length > MAX_CELL_CHARS) {
        throw new CsvParseError(`CSV cell exceeds maximum of ${MAX_CELL_CHARS} characters`);
      }
    }
  }
  const rows = parsed.slice(1);
  return { headers, rows };
}

export function buildSuggestedMappings(headers: string[]): Record<string, CsvMapTarget> {
  const mappings: Record<string, CsvMapTarget> = {};
  const used = new Set<CsvMapTarget>();
  for (const header of headers) {
    let target = autoDetectMapping(header);
    if (target !== "ignore" && used.has(target)) {
      target = "ignore";
    }
    if (target !== "ignore") used.add(target);
    mappings[header] = target;
  }
  return mappings;
}

export function validateMappings(mappings: Record<string, CsvMapTarget>): string | null {
  const targets = Object.values(mappings).filter((t) => t !== "ignore");
  if (!targets.includes("phone") && !targets.includes("email")) {
    return "Map at least one column to Phone or Email.";
  }
  const seen = new Set<CsvMapTarget>();
  for (const t of targets) {
    if (seen.has(t)) return `Multiple columns mapped to ${MAP_TARGET_LABELS[t]}.`;
    seen.add(t);
  }
  return null;
}

export type MappedRow = {
  rowIndex: number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  service_date?: string;
  job_type?: string;
  city?: string;
  notes?: string;
};

export function applyMapping(
  headers: string[],
  rows: string[][],
  mappings: Record<string, CsvMapTarget>
): MappedRow[] {
  const colIndex = new Map(headers.map((h, i) => [h, i]));
  return rows.map((row, rowIndex) => {
    const out: MappedRow = { rowIndex };
    for (const [header, target] of Object.entries(mappings)) {
      if (target === "ignore") continue;
      const idx = colIndex.get(header);
      if (idx === undefined) continue;
      const val = row[idx]?.trim();
      if (!val) continue;
      out[target] = val;
    }
    return out;
  });
}
