"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Loader2,
  Upload,
} from "lucide-react";
import {
  CSV_TEMPLATE_HEADERS,
  MAP_TARGET_LABELS,
  buildSuggestedMappings,
  parseCsv,
  validateMappings,
  type CsvMapTarget,
} from "@/lib/reputation/bulk-csv";
import type { ValidatedRecipient, ValidationSummary } from "@/lib/reputation/bulk-validate";
import { estimateBusinessDays } from "@/lib/reputation/campaign-scheduler";
import { rrInputClass, rrLabelClass, rrOutlineBtn, rrPrimaryBtn } from "@/components/reputation/review-requests-ui";
import {
  dashboardCard,
  dashboardCardTitle,
  dashboardMicro,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

const STEPS = ["Upload", "Map Columns", "Review Contacts", "Schedule"] as const;
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

type TemplateRow = { id: string; channel: string; name: string };

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={cn(dashboardCard, "p-3")}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={cn("mt-1 text-xl font-bold leading-none tabular-nums", tone ?? "text-zinc-900")}>{value}</p>
    </div>
  );
}

export function ReviewRequestsBulkWizard({
  businessId,
  templates,
  onComplete,
}: {
  businessId: string;
  templates: TemplateRow[];
  onComplete?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, CsvMapTarget>>({});
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [recipients, setRecipients] = useState<ValidatedRecipient[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [campaignName, setCampaignName] = useState("");
  const [channel, setChannel] = useState<"sms" | "email" | "both">("both");
  const [templateId, setTemplateId] = useState("");
  const [dailyLimit, setDailyLimit] = useState(10);
  const [customLimit, setCustomLimit] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [consent, setConsent] = useState(false);
  const [bypassRecentContact, setBypassRecentContact] = useState(false);

  const sampleRows = useMemo(() => rows.slice(0, 3), [rows]);
  const readyCount = summary?.ready ?? 0;

  const messageEstimate = useMemo(() => {
    const ready = recipients.filter((r) => r.status === "ready");
    let count = 0;
    for (const r of ready) {
      if ((channel === "sms" || channel === "both") && r.phone) count++;
      if ((channel === "email" || channel === "both") && r.email) count++;
    }
    return count;
  }, [recipients, channel]);

  const businessDays = estimateBusinessDays(messageEstimate, dailyLimit);

  const onFile = useCallback((file: File) => {
    setError(null);
    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const parsed = parseCsv(text);
      if (!parsed.headers.length) {
        setError("Could not parse CSV headers.");
        return;
      }
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMappings(buildSuggestedMappings(parsed.headers));
      setStep(1);
    };
    reader.readAsText(file);
  }, []);

  async function runValidation() {
    const err = validateMappings(mappings);
    if (err) {
      setMappingError(err);
      return;
    }
    setMappingError(null);
    setValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/review-requests/bulk/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          headers,
          rows,
          mapping: mappings,
          duplicateProtectionDays: bypassRecentContact ? 0 : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Validation failed");
      setSummary(json.summary);
      setRecipients(json.recipients);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  async function runValidationWithBypass() {
    setBypassRecentContact(true);
    const err = validateMappings(mappings);
    if (err) {
      setMappingError(err);
      return;
    }
    setMappingError(null);
    setValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/review-requests/bulk/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          headers,
          rows,
          mapping: mappings,
          duplicateProtectionDays: 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Validation failed");
      setSummary(json.summary);
      setRecipients(json.recipients);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  function downloadSkipped() {
    const skipped = recipients.filter((r) => r.status !== "ready");
    const header = "row_index,phone,email,status,skip_reason\n";
    const body = skipped
      .map((r) => `${r.rowIndex},"${r.phone ?? ""}","${r.email ?? ""}",${r.status},"${r.skip_reason ?? ""}"`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skipped-contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function submitCampaign(asDraft: boolean) {
    if (!asDraft && !consent) {
      setError("Please confirm customer consent before starting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/review-requests/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: campaignName || `Bulk campaign ${new Date().toLocaleDateString()}`,
          channel,
          templateId: templateId || null,
          dailySendLimit: dailyLimit,
          startDate,
          consentConfirmed: consent,
          filename,
          mapping: mappings,
          recipients,
          status: asDraft
            ? "draft"
            : startDate && startDate > new Date().toISOString().slice(0, 10)
              ? "scheduled"
              : "active",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create campaign");
      setDone(true);
      onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create campaign");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-8 text-center">
        <Check className="mx-auto h-8 w-8 text-emerald-600" />
        <h3 className="mt-2.5 text-[13px] font-semibold text-emerald-900">Campaign created</h3>
        <p className="mt-1 text-[13px] text-emerald-800">
          {readyCount} contacts queued for paced sending. View progress in Tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className={dashboardCardTitle}>Bulk Review Requests</h2>
        <p className={`mt-0.5 ${dashboardMicro}`}>
          Upload a customer list and send review requests safely over time.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
              i === step ? "bg-emerald-600 text-white" : i < step ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-500"
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px]">{i + 1}</span>
            {label}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-800">{error}</div>
      )}

      {step === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 px-3.5 py-8 text-center">
          <Upload className="mx-auto h-8 w-8 text-zinc-400" />
          <p className="mt-2.5 text-[13px] font-medium text-zinc-700">Upload a CSV file</p>
          <p className="mt-1 text-[11px] text-zinc-500">Accepted format: .csv only. Each row needs phone or email.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <label className={cn(rrPrimaryBtn, "cursor-pointer")}>
              Upload CSV
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
            <button
              type="button"
              className={rrOutlineBtn}
              onClick={() => {
                const blob = new Blob(
                  [`${CSV_TEMPLATE_HEADERS}\nJane,Doe,Jane Doe,+15551234567,jane@example.com,2026-01-15,Junk removal,Springfield,Notes`],
                  { type: "text/csv" }
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "review-requests-template.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-4 w-4" />
              Download CSV template
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <p className="text-[13px] text-zinc-600">Map your CSV columns. We auto-detected mappings — confirm before continuing.</p>
          {mappingError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-[13px] text-amber-900">{mappingError}</div>
          )}
          <div className={cn(dashboardCard, "overflow-hidden")}>
            <table className="min-w-full text-[12px]">
              <thead className="bg-zinc-50 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3.5 py-2">CSV Column</th>
                  <th className="px-3.5 py-2">Sample Value</th>
                  <th className="px-3.5 py-2">Map To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {headers.map((header) => (
                  <tr key={header}>
                    <td className="px-3.5 py-2 font-medium">{header}</td>
                    <td className="px-3.5 py-2 text-zinc-500">
                      {sampleRows.map((r, i) => {
                        const idx = headers.indexOf(header);
                        return <div key={i}>{r[idx] || "—"}</div>;
                      })}
                    </td>
                    <td className="px-3.5 py-2">
                      <select
                        className={rrInputClass}
                        value={mappings[header] ?? "ignore"}
                        onChange={(e) =>
                          setMappings((m) => ({ ...m, [header]: e.target.value as CsvMapTarget }))
                        }
                      >
                        {MAP_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {MAP_TARGET_LABELS[opt]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between">
            <button type="button" className={rrOutlineBtn} onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button type="button" className={rrPrimaryBtn} disabled={validating} onClick={() => void runValidation()}>
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && summary && (
        <div className="space-y-4">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Total rows" value={summary.total_rows} />
            <SummaryCard label="Ready to send" value={summary.ready} tone="text-emerald-700" />
            <SummaryCard label="Duplicates removed" value={summary.duplicate} />
            <SummaryCard label="Invalid contact" value={summary.invalid_contact} tone="text-red-600" />
            <SummaryCard label="Missing contact" value={summary.missing_contact} />
            <SummaryCard label="Recently contacted" value={summary.recently_contacted} />
            <SummaryCard label="Opted out" value={summary.opted_out} />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={rrOutlineBtn} onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" /> Fix mapping
            </button>
            <button type="button" className={rrOutlineBtn} onClick={downloadSkipped}>
              <Download className="h-4 w-4" /> Download skipped rows
            </button>
            {summary.recently_contacted > 0 && (
              <label className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-[13px] text-amber-900">
                <input
                  type="checkbox"
                  checked={bypassRecentContact}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setBypassRecentContact(checked);
                    if (checked) void runValidationWithBypass();
                  }}
                />
                Include contacts contacted in the last 90 days (bypass duplicate protection)
              </label>
            )}
            <button
              type="button"
              className={rrPrimaryBtn}
              disabled={summary.ready === 0}
              onClick={() => {
                setCampaignName(`Bulk — ${filename.replace(/\.csv$/i, "")}`);
                setStep(3);
              }}
            >
              Continue with {summary.ready} contacts <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-[13px]">
              <span className={rrLabelClass}>Campaign name</span>
              <input className={rrInputClass} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
            </label>
            <label className="block text-[13px]">
              <span className={rrLabelClass}>Channel</span>
              <select className={rrInputClass} value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                <option value="sms">SMS only</option>
                <option value="email">Email only</option>
                <option value="both">SMS + Email if both exist</option>
              </select>
            </label>
            <label className="block text-[13px]">
              <span className={rrLabelClass}>Template (optional)</span>
              <select className={rrInputClass} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Default template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.channel})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[13px]">
              <span className={rrLabelClass}>Start date</span>
              <input type="date" className={rrInputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="block text-[13px]">
              <span className={rrLabelClass}>Daily send limit</span>
              <select
                className={rrInputClass}
                value={[5, 10, 20].includes(dailyLimit) ? String(dailyLimit) : "custom"}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    const n = Number(customLimit) || 25;
                    setDailyLimit(n);
                    if (!customLimit) setCustomLimit(String(n));
                  } else {
                    setDailyLimit(Number(e.target.value));
                  }
                }}
              >
                <option value="5">5/day</option>
                <option value="10">10/day (recommended)</option>
                <option value="20">20/day</option>
                <option value="custom">Custom</option>
              </select>
            </label>
            {![5, 10, 20].includes(dailyLimit) && (
              <label className="block text-[13px]">
                <span className={rrLabelClass}>Custom daily limit</span>
                <input
                  type="number"
                  min={1}
                  className={rrInputClass}
                  value={customLimit || dailyLimit}
                  onChange={(e) => {
                    setCustomLimit(e.target.value);
                    setDailyLimit(Number(e.target.value) || 10);
                  }}
                />
              </label>
            )}
          </div>

          {dailyLimit > 20 && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Higher send volume may create review spikes and increase unsubscribe/complaint risk.
            </div>
          )}

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 text-[13px] text-zinc-700">
            <p className={dashboardCardTitle}>Campaign summary</p>
            <ul className="mt-2 space-y-1 text-[11px]">
              <li>This campaign will send to {readyCount} customers over ~{businessDays} business days.</li>
              <li>Daily limit: {dailyLimit}/day</li>
              <li>Send window: Monday–Friday, 10 AM–6 PM (America/New_York)</li>
              <li>Skipped contacts: {(summary?.total_rows ?? 0) - readyCount}</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 text-[13px] text-zinc-700">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            I confirm these customers gave permission to be contacted about their service experience.
          </label>

          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" className={rrOutlineBtn} onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={rrOutlineBtn} disabled={submitting} onClick={() => void submitCampaign(true)}>
                Save Draft
              </button>
              <button type="button" className={rrPrimaryBtn} disabled={submitting} onClick={() => void submitCampaign(false)}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Start Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
