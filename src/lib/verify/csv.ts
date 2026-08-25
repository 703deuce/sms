export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

const PHONE_HEADER_HINTS = [
  "phone",
  "phone_number",
  "phonenumber",
  "mobile",
  "cell",
  "telephone",
  "contact_phone",
  "fax",
];

export function suggestPhoneColumn(headers: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  for (const hint of PHONE_HEADER_HINTS) {
    const idx = lower.findIndex((h) => h.includes(hint));
    if (idx >= 0) return headers[idx];
  }
  return headers[0] || null;
}

export function rowsToObjects(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });
}

export function buildEnrichedCsv(
  headers: string[],
  rows: Record<string, string>[],
  enrich: (row: Record<string, string>) => Record<string, string>,
): string {
  const extraKeys = [
    "transovo_normalized_phone",
    "transovo_line_type",
    "transovo_carrier",
    "transovo_country",
    "transovo_ported",
    "transovo_lookup_status",
  ];
  const allHeaders = [...headers, ...extraKeys];
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };
  const lines = [allHeaders.join(",")];
  for (const row of rows) {
    const enriched = { ...row, ...enrich(row) };
    lines.push(allHeaders.map((h) => escape(String(enriched[h] ?? ""))).join(","));
  }
  return lines.join("\n");
}
