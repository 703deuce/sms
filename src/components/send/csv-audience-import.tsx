"use client";

import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { MASS_TEXT_LIST_ATTESTATION_TEXT } from "@/lib/mass-texting/constants";
import { guessCsvField, parseCsv } from "@/lib/contacts/parse-csv";
import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";

const FIELD_OPTIONS = [
  "Skip column",
  "First name",
  "Last name",
  "Phone",
  "Email",
  "Tags",
];

type ColumnMapping = {
  header: string;
  sample: string;
  field: string;
};

export function CsvAudienceImport({
  onImported,
}: {
  onImported: (listId: string, contactCount: number, listName: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [columns, setColumns] = useState<ColumnMapping[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [listName, setListName] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const allRows = parseCsv(text);
      if (allRows.length < 2) {
        setError("CSV must include a header row and at least one contact.");
        return;
      }
      const headers = allRows[0];
      const dataRows = allRows.slice(1);
      setParsedRows(dataRows);
      setColumns(
        headers.map((header, idx) => ({
          header,
          sample: dataRows[0]?.[idx] || "",
          field: guessCsvField(header),
        })),
      );
      if (!listName.trim()) {
        const base = file.name.replace(/\.[^.]+$/, "").trim() || "Imported list";
        setListName(base);
      }
      setError("");
    };
    reader.readAsText(file);
  }, [listName]);

  async function importList() {
    if (!parsedRows.length) {
      setError("Upload a CSV file first.");
      return;
    }
    if (!consentConfirmed) {
      setError("Confirm list consent before importing.");
      return;
    }

    const fieldIndex: Record<string, number> = {};
    columns.forEach((col, idx) => {
      if (col.field !== "Skip column") fieldIndex[col.field] = idx;
    });
    if (fieldIndex.Phone === undefined) {
      setError("Map at least one column to Phone.");
      return;
    }

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
        tags: rowTags,
      };
    });

    setLoading(true);
    setError("");
    try {
      const attestRes = await fetch("/api/mass-texting/import-attestation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listName: listName.trim() || undefined,
          contactCount: rows.length,
          attestationAccepted: consentConfirmed,
          source: "campaign_wizard_csv",
        }),
      });
      const attestJson = await attestRes.json().catch(() => null);
      if (!attestRes.ok) {
        throw new Error(attestJson?.error || "Attestation failed");
      }

      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          listName: listName.trim() || `Import ${new Date().toISOString().slice(0, 10)}`,
          consentSource: "csv_import",
          marketingImport: true,
          attestationId: attestJson?.data?.id,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Import failed");
      }
      const importedListId = json?.data?.listId;
      if (!importedListId) {
        throw new Error("Import succeeded but no list was created.");
      }
      const importedCount = (json?.data?.created ?? 0) + (json?.data?.updated ?? 0);
      onImported(importedListId, importedCount || rows.length, listName.trim() || "Imported list");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 rounded-[12px] border border-border bg-muted/20 p-4">
      <div>
        <Label>List name</Label>
        <Input
          value={listName}
          onChange={(e) => setListName(e.target.value)}
          placeholder="e.g. March promo list"
        />
      </div>

      <div
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card px-6 py-10 text-center"
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <Upload className="h-8 w-8 text-primary" />
        <p className="mt-2 text-[13px] font-medium">Upload CSV</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Phone column required. We&apos;ll create a send-ready list from your file.
        </p>
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
      </div>

      {columns.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[12px] font-medium text-muted-foreground">Column mapping</p>
          {columns.map((col, idx) => (
            <div key={`${col.header}-${idx}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_160px]">
              <p className="truncate text-[13px] font-medium">{col.header}</p>
              <p className="truncate text-[12px] text-muted-foreground">{col.sample || "—"}</p>
              <Select
                value={col.field}
                onChange={(e) => {
                  const next = [...columns];
                  next[idx] = { ...col, field: e.target.value };
                  setColumns(next);
                }}
              >
                {FIELD_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </Select>
            </div>
          ))}
          <p className="text-[12px] text-muted-foreground">
            {parsedRows.length.toLocaleString()} contact{parsedRows.length === 1 ? "" : "s"} in file
          </p>
        </div>
      ) : null}

      <label className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={consentConfirmed}
          onChange={(e) => setConsentConfirmed(e.target.checked)}
        />
        <span>{MASS_TEXT_LIST_ATTESTATION_TEXT}</span>
      </label>

      {error ? <p className="text-[13px] text-rose-600">{error}</p> : null}

      <Button type="button" onClick={() => void importList()} disabled={loading || !parsedRows.length}>
        {loading ? "Importing…" : "Import list for this campaign"}
      </Button>
    </div>
  );
}
