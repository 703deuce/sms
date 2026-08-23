"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Loader2,
  Upload,
} from "lucide-react";
import {
  CSV_TEMPLATE_HEADERS,
  MAP_TARGET_LABELS,
  MAX_CSV_BYTES,
  buildSuggestedMappings,
  parseCsv,
  validateMappings,
  type CsvMapTarget,
} from "@/lib/reputation/bulk-csv";
import { useActiveJobStatus } from "@/components/jobs/use-active-job-status";
import { isTerminalJobStatus } from "@/lib/jobs/active-job-status";
import { cn } from "@/lib/utils";

const STEPS = ["Upload", "Map columns", "Preview", "Import"] as const;
const MAP_OPTIONS: CsvMapTarget[] = [
  "ignore",
  "first_name",
  "last_name",
  "full_name",
  "phone",
  "email",
  "service_date",
  "job_type",
  "city",
  "notes",
];

type PreviewSummary = {
  total: number;
  ready: number;
  invalid: number;
  duplicatesInFile: number;
  existing: number;
  suppressed: number;
  rows: Array<{
    rowIndex: number;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string | null;
    status: string;
    reason?: string;
  }>;
};

type ImportHistoryRow = {
  id: string;
  filename: string | null;
  total_rows: number;
  imported_rows: number;
  skipped_rows: number;
  failed_rows: number;
  status: string;
  mode: string | null;
  created_at: string;
  completed_at: string | null;
};

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cn("mt-0.5 text-[15px] font-semibold tabular-nums", tone ?? "text-zinc-900")}>
        {value}
      </p>
    </div>
  );
}

export function ContactsImportWizard({
  businessId,
  onDone,
}: {
  businessId: string;
  onDone?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, CsvMapTarget>>({});
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewSummary | null>(null);
  const [mode, setMode] = useState<"create" | "update" | "skip">("update");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<ImportHistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/reputation/contacts/import?businessId=${businessId}`);
    const json = await res.json();
    if (res.ok) setHistory(json.imports ?? []);
  }, [businessId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const importUploadId = typeof result?.uploadId === "string" ? result.uploadId : null;
  const importActive =
    Boolean(importUploadId) &&
    (result?.status === "queued" || result?.status === "running");

  const { status: importPollStatus } = useActiveJobStatus({
    statusUrl:
      importActive && importUploadId
        ? `/api/reputation/contacts/import?businessId=${encodeURIComponent(businessId)}&uploadId=${encodeURIComponent(importUploadId)}`
        : null,
    enabled: importActive,
    isTerminal: (s) => isTerminalJobStatus(s),
    mapResponse: (json) => ({
      jobId: String(json.jobId ?? importUploadId ?? ""),
      status: String(json.status ?? "unknown"),
      phase: "active",
      progress: {
        completed: Number(json.imported ?? json.completedUnits ?? 0),
        total: Number(json.totalUnits ?? 0),
        failed: Number(json.failed ?? json.failedUnits ?? 0),
      },
      updatedAt: (json.updatedAt as string | null) ?? null,
      errorMessage: null,
      result: {
        imported: json.imported,
        skipped: json.skipped,
        failed: json.failed,
      },
    }),
  });

  const importSettledRef = useRef<string | null>(null);
  // Shared poller → local import result + history refresh on settle.
  useEffect(() => {
    if (!importPollStatus || !importUploadId) return;
    const s = importPollStatus.status;
    const detail = (importPollStatus.result ?? {}) as {
      imported?: number;
      skipped?: number;
      failed?: number;
    };
    setResult((prev) => ({
      ...(prev ?? {}),
      status: s,
      uploadId: importUploadId,
      imported: detail.imported ?? importPollStatus.progress?.completed ?? prev?.imported,
      failed: detail.failed ?? importPollStatus.progress?.failed ?? prev?.failed,
      skipped: detail.skipped ?? prev?.skipped,
    }));
    if (
      (s === "completed" || s === "failed") &&
      importSettledRef.current !== importUploadId
    ) {
      importSettledRef.current = importUploadId;
      void loadHistory();
      onDone?.();
    }
  }, [importPollStatus, importUploadId, loadHistory, onDone]);

  const sample = useMemo(() => csvRows.slice(0, 3), [csvRows]);

  const onFile = useCallback((file: File) => {
    setError(null);
    if (file.size > MAX_CSV_BYTES) {
      setError(`File exceeds the ${Math.round(MAX_CSV_BYTES / 1_000_000)}MB import limit.`);
      return;
    }
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (!parsed.headers.length) {
        setError("Could not parse CSV headers.");
        return;
      }
      setHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setMappings(buildSuggestedMappings(parsed.headers));
      setStep(1);
    };
    reader.readAsText(file);
  }, []);

  async function runPreview() {
    setMappingError(null);
    const mappingProblem = validateMappings(mappings);
    if (mappingProblem) {
      setMappingError(mappingProblem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          action: "preview",
          headers,
          csvRows,
          mapping: mappings,
          filename,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Preview failed");
      setPreview(json);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          action: "import",
          mode,
          headers,
          csvRows,
          mapping: mappings,
          filename,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      setResult(json);
      setStep(3);
      await loadHistory();
      onDone?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-900">Import contacts</h3>
          <p className="text-[12px] text-zinc-500">
            Upload → map → preview → import. Opted-out contacts stay suppressed.
          </p>
        </div>
        <div className="flex gap-1">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={cn(
                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                i === step ? "bg-emerald-50 text-emerald-800" : "bg-zinc-50 text-zinc-500"
              )}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="text-[12px] text-red-600">{error}</p>}

      {step === 0 && (
        <div className="space-y-2">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 px-4 py-8 text-center hover:bg-zinc-50">
            <Upload className="h-5 w-5 text-zinc-400" />
            <span className="mt-2 text-[13px] font-medium text-zinc-800">Drop CSV or click to upload</span>
            <span className="mt-1 text-[11px] text-zinc-500">Max 5,000 rows · UTF-8 CSV</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE_HEADERS + "\n")}`}
            download="contacts-template.csv"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 hover:underline"
          >
            <Download className="h-3.5 w-3.5" /> Download template
          </a>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <p className="text-[12px] text-zinc-600">
            File: <span className="font-medium">{filename}</span> · {csvRows.length} rows
          </p>
          {mappingError && <p className="text-[12px] text-red-600">{mappingError}</p>}
          <div className="overflow-x-auto rounded border border-zinc-100">
            <table className="min-w-full text-[12px]">
              <thead className="bg-zinc-50 text-[10px] uppercase text-zinc-500">
                <tr>
                  <th className="px-2 py-1.5 text-left">CSV column</th>
                  <th className="px-2 py-1.5 text-left">Maps to</th>
                  <th className="px-2 py-1.5 text-left">Sample</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((h) => (
                  <tr key={h} className="border-t border-zinc-50">
                    <td className="px-2 py-1.5 font-medium text-zinc-800">{h}</td>
                    <td className="px-2 py-1.5">
                      <select
                        className="h-7 rounded border border-zinc-200 px-1.5"
                        value={mappings[h] ?? "ignore"}
                        onChange={(e) =>
                          setMappings((m) => ({ ...m, [h]: e.target.value as CsvMapTarget }))
                        }
                      >
                        {MAP_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {MAP_TARGET_LABELS[opt]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 text-zinc-500">
                      {sample.map((r) => r[headers.indexOf(h)] ?? "").filter(Boolean).join(" · ") ||
                        "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px]"
              onClick={() => setStep(0)}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full bg-[#137752] px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
              onClick={() => void runPreview()}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Preview <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && preview && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Stat label="Total" value={preview.total} />
            <Stat label="Ready" value={preview.ready} tone="text-emerald-700" />
            <Stat label="Invalid" value={preview.invalid} tone="text-red-600" />
            <Stat label="Dupes in file" value={preview.duplicatesInFile} />
            <Stat label="Existing" value={preview.existing} />
            <Stat label="Suppressed" value={preview.suppressed} tone="text-amber-700" />
          </div>

          <div>
            <p className="mb-1 text-[12px] font-medium text-zinc-700">When a contact already exists</p>
            <div className="flex flex-wrap gap-3 text-[12px]">
              {(
                [
                  ["update", "Update matching contacts"],
                  ["skip", "Skip matching contacts"],
                  ["create", "Only create new (skip matches)"],
                ] as const
              ).map(([id, label]) => (
                <label key={id} className="inline-flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === id}
                    onChange={() => setMode(id)}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              Suppressed / opted-out contacts are never reactivated by import.
            </p>
          </div>

          <div className="max-h-48 overflow-auto rounded border border-zinc-100">
            <table className="min-w-full text-[11px]">
              <thead className="sticky top-0 bg-zinc-50 text-[10px] uppercase text-zinc-500">
                <tr>
                  <th className="px-2 py-1 text-left">Row</th>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Phone</th>
                  <th className="px-2 py-1 text-left">Email</th>
                  <th className="px-2 py-1 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((r) => (
                  <tr key={r.rowIndex} className="border-t border-zinc-50">
                    <td className="px-2 py-1 tabular-nums">{r.rowIndex}</td>
                    <td className="px-2 py-1">
                      {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-2 py-1">{r.phone || "—"}</td>
                    <td className="px-2 py-1">{r.email || "—"}</td>
                    <td className="px-2 py-1">
                      <span className="font-medium">{r.status}</span>
                      {r.reason ? ` · ${r.reason}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px]"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={busy || preview.ready === 0}
              className="inline-flex items-center gap-1 rounded-full bg-[#137752] px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
              onClick={() => void runImport()}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirm import
            </button>
          </div>
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-2 text-[13px]">
          <p className="font-medium text-zinc-900">
            {String(result.status) === "queued" || String(result.status) === "running"
              ? "Import in progress…"
              : String(result.status) === "failed"
                ? "Import finished with errors"
                : "Import complete"}
          </p>
          {(String(result.status) === "queued" || String(result.status) === "running") && (
            <p className="flex items-center gap-1.5 text-[12px] text-zinc-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Large imports run in the job queue. This view refreshes every few seconds.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Stat label="Imported" value={Number(result.imported ?? 0)} tone="text-emerald-700" />
            <Stat label="Skipped" value={Number(result.skipped ?? 0)} />
            <Stat label="Failed" value={Number(result.failed ?? 0)} tone="text-red-600" />
          </div>
          {typeof result.uploadId === "string" && Number(result.failed ?? 0) > 0 && (
            <a
              href={`/api/reputation/contacts/import?businessId=${businessId}&uploadId=${result.uploadId}&downloadErrors=1`}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-700 hover:underline"
            >
              <Download className="h-3.5 w-3.5" /> Download failed-row report
            </a>
          )}
          <button
            type="button"
            className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px]"
            onClick={() => {
              setStep(0);
              setPreview(null);
              setResult(null);
              setCsvRows([]);
            }}
          >
            Import another file
          </button>
        </div>
      )}

      {history.length > 0 && (
        <div className="border-t border-zinc-100 pt-3">
          <p className="mb-1.5 text-[12px] font-semibold text-zinc-800">Import history</p>
          <div className="overflow-x-auto rounded border border-zinc-100">
            <table className="min-w-full text-[11px]">
              <thead className="bg-zinc-50 text-[10px] uppercase text-zinc-500">
                <tr>
                  <th className="px-2 py-1 text-left">File</th>
                  <th className="px-2 py-1 text-left">Status</th>
                  <th className="px-2 py-1 text-right">Imported</th>
                  <th className="px-2 py-1 text-right">Failed</th>
                  <th className="px-2 py-1 text-left">When</th>
                  <th className="px-2 py-1 text-left">Errors</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-zinc-50">
                    <td className="px-2 py-1">{h.filename || "—"}</td>
                    <td className="px-2 py-1 capitalize">{h.status}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{h.imported_rows ?? 0}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{h.failed_rows ?? 0}</td>
                    <td className="px-2 py-1 text-zinc-500">
                      {new Date(h.created_at).toLocaleString()}
                    </td>
                    <td className="px-2 py-1">
                      {(h.failed_rows ?? 0) > 0 ? (
                        <a
                          href={`/api/reputation/contacts/import?businessId=${businessId}&uploadId=${h.id}&downloadErrors=1`}
                          className="text-emerald-700 hover:underline"
                        >
                          CSV
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
