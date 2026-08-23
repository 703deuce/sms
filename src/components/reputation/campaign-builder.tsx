"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Plus,
  Trash2,
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
import {
  defaultReviewRequestSequence,
  type SequenceStep,
} from "@/lib/reputation/sequence-engine";
import {
  triggerTimelineLabel,
  type CampaignTriggerConfig,
  type CampaignTriggerType,
} from "@/lib/reputation/campaign-triggers";
import { cn } from "@/lib/utils";

const BUILDER_STEPS = [
  "Details",
  "Audience",
  "Channel",
  "Sequence",
  "Content",
  "Launch",
] as const;

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

type TemplateRow = { id: string; channel: string; name: string; is_default?: boolean };
type ContactRow = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  customer_name?: string | null;
  phone_e164?: string | null;
  email_normalized?: string | null;
  sms_opt_out?: boolean;
  email_unsubscribed?: boolean;
};

function StepPill({
  label,
  index,
  active,
  done,
}: {
  label: string;
  index: number;
  active: boolean;
  done: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
        active && "bg-emerald-50 text-emerald-800",
        done && !active && "bg-zinc-100 text-zinc-700",
        !active && !done && "bg-zinc-50 text-zinc-500"
      )}
    >
      {done && !active ? <Check className="h-3 w-3" /> : <span>{index + 1}.</span>} {label}
    </span>
  );
}

export function CampaignBuilder({
  businessId,
  onComplete,
  triggerType = "manual",
  triggerConfig,
  webhookEndpointId,
}: {
  businessId: string;
  onComplete?: () => void;
  triggerType?: CampaignTriggerType;
  triggerConfig?: CampaignTriggerConfig;
  webhookEndpointId?: string | null;
}) {
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Details
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Audience
  const [audienceMode, setAudienceMode] = useState<"csv" | "contacts">("csv");
  const [filename, setFilename] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, CsvMapTarget>>({});
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [recipients, setRecipients] = useState<ValidatedRecipient[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // Channel + content + schedule
  const [channel, setChannel] = useState<"sms" | "email" | "both">("both");
  const [sequence, setSequence] = useState<SequenceStep[]>(() => defaultReviewRequestSequence("both"));
  const [templateId, setTemplateId] = useState("");
  const [emailTemplateId, setEmailTemplateId] = useState("");
  const [dailyLimit, setDailyLimit] = useState(10);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    void (async () => {
      const [tRes, cRes] = await Promise.all([
        fetch(`/api/reputation/templates?businessId=${businessId}`),
        fetch(`/api/reputation/contacts?businessId=${businessId}&limit=100`),
      ]);
      const tJson = await tRes.json().catch(() => ({}));
      const cJson = await cRes.json().catch(() => ({}));
      if (tRes.ok) setTemplates(tJson.templates ?? []);
      if (cRes.ok) setContacts(cJson.items ?? cJson.contacts ?? []);
    })();
  }, [businessId]);

  useEffect(() => {
    setSequence(defaultReviewRequestSequence(channel === "email" ? "email" : channel === "sms" ? "sms" : "both"));
  }, [channel]);

  const readyCount = useMemo(() => {
    if (audienceMode === "contacts") {
      return contacts.filter(
        (c) =>
          selectedContactIds.has(c.id) &&
          (c.phone_e164 || c.email_normalized) &&
          !(channel !== "email" && c.sms_opt_out && !c.email_normalized) &&
          !(channel === "email" && c.email_unsubscribed)
      ).length;
    }
    return summary?.ready ?? 0;
  }, [audienceMode, contacts, selectedContactIds, channel, summary]);

  const messageEstimate = useMemo(() => {
    if (audienceMode === "contacts") {
      let n = 0;
      for (const c of contacts) {
        if (!selectedContactIds.has(c.id)) continue;
        if ((channel === "sms" || channel === "both") && c.phone_e164 && !c.sms_opt_out) n++;
        if ((channel === "email" || channel === "both") && c.email_normalized && !c.email_unsubscribed)
          n++;
      }
      return n;
    }
    let count = 0;
    for (const r of recipients.filter((x) => x.status === "ready")) {
      if ((channel === "sms" || channel === "both") && r.phone) count++;
      if ((channel === "email" || channel === "both") && r.email) count++;
    }
    return count;
  }, [audienceMode, contacts, selectedContactIds, channel, recipients]);

  const businessDays = estimateBusinessDays(messageEstimate, dailyLimit);

  const onFile = async (file: File) => {
    setError(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    setFilename(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setMappings(buildSuggestedMappings(parsed.headers));
    setSummary(null);
    setRecipients([]);
  };

  const validateCsv = useCallback(async () => {
    setMappingError(null);
    setError(null);
    const v = validateMappings(mappings);
    if (v) {
      setMappingError(v);
      return false;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/reputation/review-requests/bulk/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          headers,
          rows,
          mapping: mappings,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Validation failed");
      setSummary(json.summary);
      setRecipients(json.recipients ?? []);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation failed");
      return false;
    } finally {
      setBusy(false);
    }
  }, [businessId, headers, rows, mappings]);

  const contactsAsRecipients = useCallback((): ValidatedRecipient[] => {
    let idx = 0;
    return contacts
      .filter((c) => selectedContactIds.has(c.id))
      .map((c) => {
        const phone = c.phone_e164 ?? undefined;
        const email = c.email_normalized ?? undefined;
        const opted =
          (channel !== "email" && c.sms_opt_out && !email) ||
          (channel === "email" && c.email_unsubscribed) ||
          (!phone && !email);
        idx += 1;
        return {
          rowIndex: idx,
          status: opted ? ("opted_out" as const) : ("ready" as const),
          skip_reason: opted ? "opted_out_or_missing_contact" : undefined,
          first_name: c.first_name ?? undefined,
          last_name: c.last_name ?? undefined,
          full_name: c.customer_name ?? undefined,
          phone,
          email,
        };
      });
  }, [contacts, selectedContactIds, channel]);

  const isAutomatic = triggerType === "webhook" || triggerType === "api";

  const canNext = (): boolean => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) {
      // Webhook campaigns can activate with an empty audience (events enroll later).
      if (isAutomatic) return true;
      if (audienceMode === "csv") return recipients.length > 0 && (summary?.ready ?? 0) > 0;
      return readyCount > 0;
    }
    if (step === 2) return Boolean(channel);
    if (step === 3) return sequence.some((s) => s.step_type.startsWith("send_"));
    if (step === 4) return true;
    if (step === 5) return consent && (isAutomatic || readyCount > 0);
    return false;
  };

  const goNext = async () => {
    setError(null);
    if (step === 1 && audienceMode === "csv" && !summary) {
      const ok = await validateCsv();
      if (!ok) return;
    }
    if (step < BUILDER_STEPS.length - 1) setStep((s) => s + 1);
  };

  const launch = async (status: "draft" | "scheduled" | "active") => {
    setBusy(true);
    setError(null);
    try {
      const payloadRecipients =
        audienceMode === "contacts" ? contactsAsRecipients() : recipients;
      const res = await fetch("/api/reputation/review-requests/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: name.trim(),
          description: description.trim() || null,
          channel,
          templateId: templateId || null,
          emailTemplateId: emailTemplateId || null,
          dailySendLimit: dailyLimit,
          sendDays: [1, 2, 3, 4, 5],
          sendWindowStart: "10:00",
          sendWindowEnd: "18:00",
          timezone: "America/New_York",
          duplicateProtectionDays: 60,
          startDate,
          consentConfirmed: consent,
          filename: audienceMode === "csv" ? filename : "contacts.csv",
          mapping: audienceMode === "csv" ? mappings : { phone: "phone", email: "email" },
          recipients: payloadRecipients,
          sequence,
          status,
          triggerType,
          triggerConfig: triggerConfig ?? { allowManualEnrollment: true },
          webhookEndpointId: webhookEndpointId ?? null,
          enrollmentSource: audienceMode === "csv" ? "csv" : "contacts",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create campaign");
      onComplete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed");
    } finally {
      setBusy(false);
    }
  };

  const updateStep = (idx: number, patch: Partial<SequenceStep>) => {
    setSequence((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeStep = (idx: number) => {
    setSequence((prev) => prev.filter((_, i) => i !== idx));
  };

  const addWaitBeforeEnd = () => {
    setSequence((prev) => {
      const endIdx = prev.findIndex((s) => s.step_type === "end");
      const wait: SequenceStep = {
        step_key: `wait_${Date.now()}`,
        step_type: "wait",
        config: { days: 2 },
      };
      const sendType = channel === "email" ? "send_email" : "send_sms";
      const reminder: SequenceStep = {
        step_key: `reminder_${Date.now()}`,
        step_type: sendType,
        config:
          channel === "both"
            ? { template: "reminder", channels: ["sms", "email"] }
            : { template: "reminder" },
      };
      const gate: SequenceStep = {
        step_key: `gate_${Date.now()}`,
        step_type: "condition",
        config: {
          all: ["no_activity", "customer_opted_out:false"],
          then: reminder.step_key,
          else: "end",
        },
      };
      const copy = [...prev];
      const at = endIdx >= 0 ? endIdx : copy.length;
      copy.splice(at, 0, wait, gate, reminder);
      return copy;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {BUILDER_STEPS.map((label, i) => (
          <StepPill key={label} label={label} index={i} active={step === i} done={i < step} />
        ))}
      </div>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] text-red-700">
          {error}
        </p>
      )}

      {step === 0 && (
        <div className="space-y-2">
          <label className="block text-[12px] font-medium text-zinc-700">
            Campaign name
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-[13px]"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="March review requests"
            />
          </label>
          <label className="block text-[12px] font-medium text-zinc-700">
            Description (optional)
            <textarea
              className="mt-1 w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-[13px]"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          {isAutomatic ? (
            <p className="rounded-md border border-sky-100 bg-sky-50 px-2.5 py-2 text-[12px] text-sky-900">
              This campaign uses an automatic trigger. You can skip audience selection and activate —
              customers enroll when webhook events arrive. Optional: seed a few contacts below for a
              test launch.
            </p>
          ) : null}
          <div className="flex gap-1">
            {(
              [
                ["csv", "Upload CSV"],
                ["contacts", "Select contacts"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAudienceMode(id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[12px] font-medium",
                  audienceMode === id ? "bg-emerald-50 text-emerald-800" : "text-zinc-600 hover:bg-zinc-50"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {audienceMode === "csv" ? (
            <div className="space-y-2">
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 px-3 py-6 text-center hover:bg-zinc-50">
                <Upload className="mb-1 h-5 w-5 text-zinc-400" />
                <span className="text-[12px] font-medium text-zinc-700">
                  {filename || "Drop CSV or click to upload"}
                </span>
                <span className="mt-0.5 text-[11px] text-zinc-500">
                  Columns: {CSV_TEMPLATE_HEADERS.split(",").slice(0, 4).join(", ")}…
                </span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFile(f);
                  }}
                />
              </label>
              {headers.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Map columns
                  </p>
                  {headers.map((h) => (
                    <div key={h} className="flex items-center gap-2 text-[12px]">
                      <span className="w-28 truncate text-zinc-600">{h}</span>
                      <select
                        className="flex-1 rounded border border-zinc-200 px-2 py-1"
                        value={mappings[h] ?? "ignore"}
                        onChange={(e) =>
                          setMappings((m) => ({ ...m, [h]: e.target.value as CsvMapTarget }))
                        }
                      >
                        {MAP_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {MAP_TARGET_LABELS[opt] ?? opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                  {mappingError && <p className="text-[12px] text-red-600">{mappingError}</p>}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void validateCsv()}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Validate & preview
                  </button>
                  {summary && (
                    <p className="text-[12px] text-zinc-600">
                      Ready {summary.ready} · Skipped {summary.skipped} · Total {summary.total_rows}
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded border border-zinc-100">
              <table className="min-w-full text-[11px]">
                <thead className="sticky top-0 bg-zinc-50 text-[10px] uppercase text-zinc-500">
                  <tr>
                    <th className="px-2 py-1 text-left"> </th>
                    <th className="px-2 py-1 text-left">Name</th>
                    <th className="px-2 py-1 text-left">Phone</th>
                    <th className="px-2 py-1 text-left">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} className="border-t border-zinc-50">
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={selectedContactIds.has(c.id)}
                          onChange={(e) => {
                            setSelectedContactIds((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(c.id);
                              else next.delete(c.id);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="px-2 py-1">
                        {c.customer_name ||
                          [c.first_name, c.last_name].filter(Boolean).join(" ") ||
                          "—"}
                      </td>
                      <td className="px-2 py-1">{c.phone_e164 || "—"}</td>
                      <td className="px-2 py-1">{c.email_normalized || "—"}</td>
                    </tr>
                  ))}
                  {!contacts.length && (
                    <tr>
                      <td colSpan={4} className="px-2 py-3 text-zinc-500">
                        No contacts yet. Import CSV on the Contacts page first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-zinc-500">{readyCount} ready recipients</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-2">
          <p className="text-[12px] text-zinc-600">
            Pick how this campaign reaches people. Your plan meters SMS and email separately —
            Starter has email only; Pro/Agency include SMS caps.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                [
                  "sms",
                  "SMS only",
                  "Twilio texts with STOP opt-out. Needs phone numbers and SMS quota on the plan.",
                ],
                [
                  "email",
                  "Email only",
                  "Brevo emails with unsubscribe + reply tracking. Needs email addresses.",
                ],
                [
                  "both",
                  "SMS + email",
                  "Sends both on each wave when the recipient has that contact — reminders included.",
                ],
              ] as const
            ).map(([id, label, help]) => (
              <button
                key={id}
                type="button"
                onClick={() => setChannel(id)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-[12px]",
                  channel === id
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                )}
              >
                <span className="block font-semibold">{label}</span>
                <span className="mt-1 block text-[11px] font-normal text-zinc-500">{help}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          <p className="text-[11px] text-zinc-500">
            Timeline: Trigger → Wait → Message → Wait → Reminder → End.
            {channel === "both"
              ? " With SMS + email, each send wave delivers both channels (same step) when contacts exist."
              : channel === "sms"
                ? " This campaign is SMS-only — email steps are ignored."
                : " This campaign is email-only — SMS steps are ignored."}
          </p>
          <div className="rounded-md border border-emerald-200 bg-emerald-50/50 px-2.5 py-2 text-[12px]">
            <p className="font-semibold text-emerald-900">
              Trigger · {triggerTimelineLabel(triggerType, triggerConfig)}
            </p>
            <p className="mt-0.5 text-[11px] text-emerald-800/80">
              {isAutomatic
                ? "Customers enter when this endpoint receives a valid event. Not a message step."
                : "Contacts enter when selected, imported, or added by staff. Not a message step."}
            </p>
          </div>
          <ol className="space-y-1.5">
            {sequence.map((s, i) => (
              <li
                key={`${s.step_key}-${i}`}
                className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-100 bg-zinc-50/50 px-2 py-1.5 text-[12px]"
              >
                <span className="w-5 tabular-nums text-zinc-400">{i + 1}</span>
                <select
                  className="rounded border border-zinc-200 bg-white px-1.5 py-1"
                  value={s.step_type}
                  disabled={s.step_type === "end"}
                  onChange={(e) =>
                    updateStep(i, {
                      step_type: e.target.value as SequenceStep["step_type"],
                    })
                  }
                >
                  <option value="send_sms">Send SMS</option>
                  <option value="send_email">Send email</option>
                  <option value="wait">Wait</option>
                  <option value="condition">Condition</option>
                  <option value="end">End</option>
                </select>
                {s.step_type === "wait" && (
                  <label className="flex items-center gap-1 text-zinc-600">
                    Days
                    <input
                      type="number"
                      min={1}
                      max={30}
                      className="w-14 rounded border border-zinc-200 px-1 py-0.5"
                      value={Number(s.config.days ?? 2)}
                      onChange={(e) =>
                        updateStep(i, {
                          config: { ...s.config, days: Number(e.target.value) },
                        })
                      }
                    />
                  </label>
                )}
                {s.step_type === "condition" && (
                  <span className="text-[11px] text-zinc-500">
                    If no activity & not opted out → reminder, else end
                  </span>
                )}
                <span className="ml-auto font-mono text-[10px] text-zinc-400">{s.step_key}</span>
                {s.step_type !== "end" && i > 0 && (
                  <button
                    type="button"
                    className="text-zinc-400 hover:text-red-600"
                    onClick={() => removeStep(i)}
                    aria-label="Remove step"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={addWaitBeforeEnd}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700"
          >
            <Plus className="h-3 w-3" /> Add wait + reminder
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2">
          {(channel === "sms" || channel === "both") && (
            <label className="block text-[12px] font-medium text-zinc-700">
              SMS template
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-[13px]"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">Default SMS template</option>
                {templates
                  .filter((t) => t.channel === "sms")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.is_default ? " ★" : ""}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {(channel === "email" || channel === "both") && (
            <label className="block text-[12px] font-medium text-zinc-700">
              Email template
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 px-2.5 py-1.5 text-[13px]"
                value={channel === "email" ? templateId : emailTemplateId}
                onChange={(e) => {
                  if (channel === "email") setTemplateId(e.target.value);
                  else setEmailTemplateId(e.target.value);
                }}
              >
                <option value="">Default email template</option>
                {templates
                  .filter((t) => t.channel === "email")
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.is_default ? " ★" : ""}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <p className="text-[11px] text-zinc-500">
            Messages use tracked links that redirect immediately to your Google review URL. Live
            previews and test sends are on Templates.
          </p>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-2 text-[12px]">
          <div className="rounded-md border border-zinc-100 bg-zinc-50/60 p-2.5 space-y-1">
            <p className="font-semibold text-zinc-900">Review & launch</p>
            <p className="text-zinc-600">
              <span className="font-medium text-zinc-800">{name}</span> · Trigger:{" "}
              {triggerTimelineLabel(triggerType, triggerConfig)} ·{" "}
              {channel === "both" ? "SMS + email" : channel === "sms" ? "SMS only" : "Email only"} ·{" "}
              {isAutomatic && readyCount === 0
                ? "no seeded recipients (webhook enrolls later)"
                : `${readyCount} recipients`}{" "}
              · ~{messageEstimate} initial messages · {sequence.length} sequence steps · ~
              {businessDays} business day(s) at {dailyLimit}/day
            </p>
            {channel !== "email" && (
              <p className="text-[11px] text-amber-800">
                SMS uses your plan’s monthly SMS quota. If the quota is exhausted mid-campaign, sending
                pauses until the next cycle (or you upgrade).
              </p>
            )}
            <p className="text-zinc-500">
              Window Mon–Fri 10:00–18:00 America/New_York · start {startDate}
            </p>
          </div>
          <label className="flex items-center gap-2">
            Daily send limit
            <input
              type="number"
              min={1}
              max={500}
              className="w-20 rounded border border-zinc-200 px-2 py-1"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value) || 10)}
            />
          </label>
          <label className="flex items-center gap-2">
            Start date
            <input
              type="date"
              className="rounded border border-zinc-200 px-2 py-1"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="flex items-start gap-2 text-zinc-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I confirm these contacts consented to receive messages and this campaign requests honest
            reviews (not paid or incentivized five-star-only reviews).
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        )}
        {step < BUILDER_STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canNext() || busy}
            onClick={() => void goNext()}
            className="inline-flex items-center gap-1 rounded-full bg-[#137752] px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void launch("draft")}
              className="rounded-md border border-zinc-200 px-2.5 py-1.5 text-[12px] font-medium"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={!canNext() || busy}
              onClick={() => void launch(startDate > new Date().toISOString().slice(0, 10) ? "scheduled" : "active")}
              className="inline-flex items-center gap-1 rounded-full bg-[#137752] px-2.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {isAutomatic ? "Activate campaign" : "Launch campaign"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
