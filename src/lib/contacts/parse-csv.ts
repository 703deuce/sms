/** RFC-style CSV parser used by Mass Texting import (quotes, commas, blank rows). */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

export function guessCsvField(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (h.includes("firstname") || h === "first") return "First name";
  if (h.includes("lastname") || h === "last") return "Last name";
  if (h.includes("phone") || h.includes("mobile") || h.includes("cell")) return "Phone";
  if (h.includes("email")) return "Email";
  if (h.includes("consentdate") || h.includes("optindate")) return "Consent date";
  if (h.includes("consentsource") || h === "source") return "Consent source";
  if (h.includes("tag")) return "Tags";
  return "Skip column";
}
