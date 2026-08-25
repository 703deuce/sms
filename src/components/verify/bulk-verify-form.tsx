"use client";

import { useState } from "react";
import Link from "next/link";

type Preview = {
  phoneColumn: string;
  totalRows: number;
  uniqueNumbers: number;
  duplicateRows: number;
  creditsRequired: number;
  creditsAvailable: number;
};

export function BulkVerifyForm() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [phoneColumn, setPhoneColumn] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function previewCsv() {
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("previewOnly", "true");
      if (phoneColumn) form.append("phoneColumn", phoneColumn);
      const res = await fetch("/api/verify/bulk", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Preview failed");
      setPreview(json.data);
      setPhoneColumn(json.data.phoneColumn);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function startJob() {
    if (!file) return;
    setLoading(true);
    setStatus(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (phoneColumn) form.append("phoneColumn", phoneColumn);
      const res = await fetch("/api/verify/bulk", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        if (json.error === "INSUFFICIENT_CREDITS") {
          setStatus("Insufficient credits — buy more on the Billing page.");
          return;
        }
        throw new Error(json.error || "Job failed");
      }
      setStatus(`Job started. Job ID: ${json.data.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Job failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded-lg border p-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Upload CSV</label>
          <input
            className="mt-1 block w-full text-sm"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={previewCsv}
            disabled={!file || loading}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={startJob}
            disabled={!file || loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Start Verification
          </button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-lg border p-6 text-sm space-y-2">
          <p>{preview.totalRows.toLocaleString()} rows detected</p>
          <p>{preview.uniqueNumbers.toLocaleString()} unique phone numbers</p>
          <p>{preview.duplicateRows.toLocaleString()} duplicate rows</p>
          <p>Estimated credits required: {preview.creditsRequired.toLocaleString()}</p>
          <p>Available credits: {preview.creditsAvailable.toLocaleString()}</p>
          <p>Phone column: {preview.phoneColumn}</p>
        </div>
      ) : null}

      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}

      <p className="text-sm text-muted-foreground">
        Track progress on <Link href="/verify/jobs" className="text-primary hover:underline">Jobs</Link>.
      </p>
    </div>
  );
}
