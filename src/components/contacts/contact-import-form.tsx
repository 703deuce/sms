"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MASS_TEXT_LIST_ATTESTATION_TEXT } from "@/lib/mass-texting/constants";
import { FileSpreadsheet, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

type ListOption = { id: string; name: string };

const FIELD_OPTIONS = [
  "Skip column",
  "First name",
  "Last name",
  "Phone",
  "Email",
  "Consent date",
  "Consent source",
  "Tags",
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

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
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i += 1;
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

function guessField(header: string): string {
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

type ColumnMapping = {
  header: string;
  sample: string;
  field: string;
};

export function ContactImportForm({
  lists,
  marketingImport = false,
}: {
  lists: ListOption[];
  marketingImport?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [columns, setColumns] = useState<ColumnMapping[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [listName, setListName] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const allRows = parseCsv(text);
      if (allRows.length < 2) {
        setError("File must include a header row and at least one data row");
        return;
      }
      const headers = allRows[0];
      const dataRows = allRows.slice(1);
      setParsedRows(dataRows);
      setRowCount(dataRows.length);
      setColumns(
        headers.map((header, idx) => ({
          header,
          sample: dataRows[0]?.[idx] || "",
          field: guessField(header),
        })),
      );
      setError(null);
      setResult(null);
    };
    reader.readAsText(file);
  }, []);

  async function handleImport() {
    if (!parsedRows.length) {
      setError("Upload a CSV file first");
      return;
    }
    if (!consentConfirmed) {
      setError("Confirm consent before importing");
      return;
    }

    const fieldIndex: Record<string, number> = {};
    columns.forEach((col, idx) => {
      if (col.field !== "Skip column") fieldIndex[col.field] = idx;
    });

    if (fieldIndex["Phone"] === undefined) {
      setError("Map at least one column to Phone");
      return;
    }

    const globalTags = tagInput
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const rows = parsedRows.map((row) => {
      const get = (field: string) => row[fieldIndex[field]]?.trim() || "";
      const rowTags = get("Tags")
        ? get("Tags")
            .split(/[,;]/)
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      return {
        phone: get("Phone"),
        firstName: get("First name") || undefined,
        lastName: get("Last name") || undefined,
        email: get("Email") || undefined,
        tags: [...globalTags, ...rowTags],
      };
    });

    const consentSourceIdx = columns.findIndex((c) => c.field === "Consent source");
    const consentSource =
      consentSourceIdx >= 0
        ? parsedRows[0]?.[consentSourceIdx]?.trim()
        : undefined;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      let attestationId: string | undefined;
      if (marketingImport) {
        const attestRes = await fetch("/api/mass-texting/import-attestation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listName: listName || undefined,
            contactCount: rows.length,
            attestationAccepted: consentConfirmed,
            source: "csv_import",
          }),
        });
        const attestJson = await attestRes.json().catch(() => null);
        if (!attestRes.ok) {
          throw new Error(attestJson?.error || "Attestation failed");
        }
        attestationId = attestJson?.data?.id;
      }

      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          listName: listName || undefined,
          consentSource: consentSource || "import",
          marketingImport,
          attestationId,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Import failed");
      }
      const { created, updated, errors } = json.data || {};
      setResult(
        `Import complete: ${created ?? 0} created, ${updated ?? 0} updated${
          errors?.length ? `, ${errors.length} errors` : ""
        }`,
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardTitle>Step 1 — Upload file</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            CSV with phone numbers and documented consent for each contact.
          </p>
          <div
            className="mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center"
            onClick={() => fileRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <Upload className="h-10 w-10 text-primary" />
            <p className="mt-3 font-medium">Drag and drop your file here</p>
            <p className="mt-1 text-sm text-muted-foreground">or click to browse</p>
            <Button variant="outline" className="mt-4" type="button">
              Choose file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {rowCount > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {rowCount} rows · {columns.length} columns loaded
              </p>
            ) : null}
          </div>
        </Card>

        {columns.length > 0 ? (
          <Card>
            <CardTitle>Step 2 — Map fields</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Match columns from your file to Transovo contact fields.
            </p>
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>CSV column</TH>
                  <TH>Sample value</TH>
                  <TH>Transovo field</TH>
                </TR>
              </THead>
              <TBody>
                {columns.map((row, idx) => (
                  <TR key={row.header}>
                    <TD className="font-mono text-xs">{row.header}</TD>
                    <TD className="text-muted-foreground">{row.sample}</TD>
                    <TD>
                      <Select
                        value={row.field}
                        aria-label={`Map ${row.header}`}
                        onChange={(e) => {
                          const field = e.target.value;
                          setColumns((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, field } : c)),
                          );
                        }}
                      >
                        {FIELD_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </Select>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        ) : null}

        <Card>
          <CardTitle>Step 3 — Import settings</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="import-list">Add to list</Label>
              <Select
                id="import-list"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
              >
                <option value="">No list</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.name}>{list.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="import-tags">Apply tags</Label>
              <Input
                id="import-tags"
                placeholder="sms-opt-in, import-july"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-border bg-muted/40 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 rounded border-border"
                checked={consentConfirmed}
                onChange={(e) => setConsentConfirmed(e.target.checked)}
                aria-describedby="consent-help"
              />
              <span>
                <span className="block text-sm font-medium">
                  {marketingImport
                    ? "I confirm that the recipients in this list have provided the required consent to receive these messages"
                    : "I confirm all imported contacts have provided express consent to receive SMS"}
                </span>
                <span id="consent-help" className="mt-1 block text-xs text-muted-foreground">
                  {marketingImport
                    ? MASS_TEXT_LIST_ATTESTATION_TEXT
                    : "Required for TCPA compliance. Consent source and date columns should be mapped when available."}
                </span>
              </span>
            </label>
          </div>

          {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
          {result ? <p className="mt-4 text-sm text-violet-700">{result}</p> : null}

          <div className="mt-6 flex gap-2">
            <Button onClick={handleImport} disabled={loading || !parsedRows.length}>
              {loading ? "Importing…" : "Start import"}
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardTitle>Import checklist</CardTitle>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <StatusChip status={columns.some((c) => c.field === "Phone") ? "Completed" : "Pending"} />
              <span>Phone numbers in E.164 or US format</span>
            </li>
            <li className="flex items-start gap-2">
              <StatusChip status={consentConfirmed ? "Completed" : "Pending"} />
              <span>Consent confirmed for import</span>
            </li>
            <li className="flex items-start gap-2">
              <StatusChip
                status={
                  columns.some((c) => c.field === "Consent source") ? "Completed" : "Pending"
                }
              />
              <span>Consent source documented</span>
            </li>
          </ul>
        </Card>

        <Card>
          <CardTitle>Need a template?</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Use a CSV with columns: first_name, last_name, mobile, email_address, source.
          </p>
          <Button variant="outline" className="mt-4 w-full" type="button">
            <FileSpreadsheet className="h-4 w-4" />
            Sample format shown in Step 2
          </Button>
        </Card>
      </div>
    </div>
  );
}
