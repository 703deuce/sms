"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Calendar,
  Loader2,
  Mail,
  MessageSquare,
  Send,
} from "lucide-react";
import { renderTemplate } from "@/lib/reputation/template-vars";
import {
  pctOfTotal,
  responseRate,
  replyRate,
  failureRate,
  ReviewRequestsKpiCard,
  ReviewRequestsKpiRow as KpiRow,
} from "@/components/reputation/review-requests-kpi-cards";
import {
  rrInputClass,
  rrLabelClass,
  rrOutlineBtn,
  rrPrimaryBtn,
  statusPill,
} from "@/components/reputation/review-requests-ui";
import {
  dashboardBody,
  dashboardCard,
  dashboardCardTitle,
  dashboardMicro,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

type TemplateRow = {
  id: string;
  channel: string;
  subject?: string | null;
  body: string;
  is_default?: boolean;
};

type SendRow = {
  id: string;
  channel: string;
  recipient_email?: string | null;
  recipient_phone?: string | null;
  status: string;
  message_body: string;
  sent_at?: string | null;
  created_at: string;
  error_message?: string | null;
  has_reply?: boolean;
  review_request_contacts?: { customer_name?: string | null } | null;
};

type Stats = {
  total_sent: number;
  email_sent: number;
  sms_sent: number;
  manual_sent: number;
  failed: number;
  replies?: number;
  last_7_days: number;
  last_30_days: number;
  recent_sends: SendRow[];
  trial_sms_template?: string | null;
};

function formatSentAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function sendStatusKey(status: string, hasReply?: boolean) {
  if (hasReply) return "sent";
  if (status === "failed") return "failed";
  if (status === "queued" || status === "pending" || status === "sending") return "queued";
  if (["sent", "delivered", "clicked", "completed"].includes(status)) return "sent";
  return "pending";
}

export function ReviewRequestsSendSection({
  businessId,
  businessName,
  reviewUrl,
  templates,
  stats,
  onSent,
}: {
  businessId: string;
  businessName: string;
  reviewUrl: string | null;
  templates: TemplateRow[];
  stats: Stats | null;
  onSent: () => Promise<void>;
}) {
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    serviceType: "",
    channel: "email" as "email" | "sms" | "both",
    customMessage: "",
    notes: "",
  });
  const [sending, setSending] = useState<"email" | "sms" | "both" | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const emailTemplate = templates.find((t) => t.channel === "email" && t.is_default) ?? templates.find((t) => t.channel === "email");
  const smsTemplate = templates.find((t) => t.channel === "sms" && t.is_default) ?? templates.find((t) => t.channel === "sms");

  const previewVars = {
    customer_name: form.customerName || "there",
    business_name: businessName,
    review_link: reviewUrl ?? "{{review_link}}",
    service_type: form.serviceType || "recent project",
  };

  const previewChannel = form.channel === "both" ? "sms" : form.channel;
  const previewTemplate = previewChannel === "email" ? emailTemplate : smsTemplate;
  const previewBody = previewTemplate
    ? renderTemplate(previewTemplate.body, previewVars)
    : form.customMessage || "Select a template or enter a custom message.";

  async function sendEmail() {
    const res = await fetch("/api/reputation/review-requests/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        customerName: form.customerName,
        customerEmail: form.customerEmail,
        serviceType: form.serviceType || undefined,
        customMessage: form.customMessage || undefined,
        templateId: emailTemplate?.id,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Email failed");
  }

  async function sendSms() {
    const res = await fetch("/api/reputation/review-requests/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        serviceType: form.serviceType || undefined,
        customMessage: form.customMessage || undefined,
        templateId: smsTemplate?.id,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "SMS failed");
    return json as { usedTrialTemplate?: boolean };
  }

  async function handleSend(mode: "email" | "sms" | "both") {
    setError(null);
    setSuccess(null);

    if (!reviewUrl) {
      setError("Review link missing. Generate review link first.");
      return;
    }
    if (!form.customerName.trim()) {
      setError("Customer name is required.");
      return;
    }
    if ((mode === "email" || mode === "both") && !form.customerEmail.trim()) {
      setError("Customer email is required for email send.");
      return;
    }
    if ((mode === "sms" || mode === "both") && !form.customerPhone.trim()) {
      setError("Customer phone is required for SMS send.");
      return;
    }

    setSending(mode);
    try {
      const errors: string[] = [];
      let smsTrialUsed = false;
      if (mode === "email" || mode === "both") {
        try {
          await sendEmail();
        } catch (e) {
          errors.push(`Email failed: ${e instanceof Error ? e.message : "unknown"}`);
        }
      }
      if (mode === "sms" || mode === "both") {
        try {
          const smsResult = await sendSms();
          smsTrialUsed = Boolean(smsResult?.usedTrialTemplate);
        } catch (e) {
          errors.push(`SMS failed: ${e instanceof Error ? e.message : "unknown"}`);
        }
      }

      if (errors.length) {
        setError(errors.join(" "));
      } else {
        setSuccess(
          smsTrialUsed
            ? "Review request sent. SMS used Twilio trial template for delivery."
            : "Review request sent."
        );
        setForm((f) => ({ ...f, customerName: "", customerEmail: "", customerPhone: "", serviceType: "" }));
      }
      await onSent();
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="space-y-4">
      {stats && (
        <KpiRow cols={6}>
          <ReviewRequestsKpiCard
            label="7 days"
            value={stats.last_7_days}
            sub="Requests sent"
            icon={Calendar}
            iconClass="bg-emerald-50 text-emerald-600"
          />
          <ReviewRequestsKpiCard
            label="30 days"
            value={stats.last_30_days}
            sub="Requests sent"
            icon={Calendar}
            iconClass="bg-emerald-50 text-emerald-600"
          />
          <ReviewRequestsKpiCard
            label="Email"
            value={stats.email_sent}
            sub={pctOfTotal(stats.email_sent, stats.total_sent)}
            icon={Mail}
            iconClass="bg-violet-50 text-violet-600"
          />
          <ReviewRequestsKpiCard
            label="SMS"
            value={stats.sms_sent}
            sub={pctOfTotal(stats.sms_sent, stats.total_sent)}
            icon={MessageSquare}
            iconClass="bg-sky-50 text-sky-600"
          />
          <ReviewRequestsKpiCard
            label="Replies"
            value={stats.replies ?? 0}
            sub={replyRate(stats.replies ?? 0, stats.total_sent)}
            icon={ArrowLeftRight}
            iconClass="bg-emerald-50 text-emerald-600"
          />
          <ReviewRequestsKpiCard
            label="Failed"
            value={stats.failed}
            sub={failureRate(stats.failed, stats.total_sent + stats.failed)}
            icon={AlertTriangle}
            iconClass="bg-red-50 text-red-600"
          />
        </KpiRow>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <div className={cn(dashboardCard, "p-3.5")}>
          <h3 className={dashboardCardTitle}>Send review request</h3>
          <p className={`mt-0.5 ${dashboardBody}`}>
            Fill in the details below to send a review request to your customer.
          </p>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">{error}</div>
          )}
          {success && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800">
              {success}
            </div>
          )}

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={rrLabelClass}>
                Customer name <span className="text-red-500">*</span>
              </label>
              <input
                placeholder="e.g. Jane Smith"
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                className={rrInputClass}
              />
            </div>
            <div>
              <label className={rrLabelClass}>Service type</label>
              <select
                value={form.serviceType}
                onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))}
                className={rrInputClass}
              >
                <option value="">Select service</option>
                <option value="Junk Removal">Junk Removal</option>
                <option value="Hauling">Hauling</option>
                <option value="Cleanout">Cleanout</option>
              </select>
            </div>
            <div>
              <label className={rrLabelClass}>Email</label>
              <input
                type="email"
                placeholder="jane.smith@email.com"
                value={form.customerEmail}
                onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                className={rrInputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={rrLabelClass}>Phone</label>
              <div className="mt-1 flex overflow-hidden rounded-lg border border-zinc-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20">
                <span className="flex items-center border-r border-zinc-200 bg-zinc-50 px-2.5 text-xs text-zinc-500">
                  🇺🇸
                </span>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={form.customerPhone}
                  onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                  className="min-w-0 flex-1 border-0 bg-white px-3.5 py-2 text-[13px] outline-none"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-medium text-zinc-500">Preferred channel</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["email", "sms", "both"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, channel: ch }))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-[13px] font-medium capitalize",
                    form.channel === ch
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  )}
                >
                  {form.channel === ch && <span className="text-emerald-600">✓</span>}
                  {ch === "both" ? "Both" : ch}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="text-xs font-medium text-zinc-500">Notes (optional)</label>
            <textarea
              rows={3}
              maxLength={250}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-[13px] outline-none focus:border-emerald-500"
              placeholder="Internal notes about this request…"
            />
            <p className="mt-1 text-right text-[10px] text-zinc-400">{form.notes.length} / 250</p>
          </div>

          {stats?.trial_sms_template && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                SMS is in trial mode — messages will use the <strong>{stats.trial_sms_template}</strong>{" "}
                template. <button type="button" className="font-medium underline">Learn more</button>
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!sending}
              onClick={() => void handleSend("email")}
              className={rrPrimaryBtn}
            >
              {sending === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send Email
            </button>
            <button
              type="button"
              disabled={!!sending}
              onClick={() => void handleSend("sms")}
              className={rrOutlineBtn}
            >
              {sending === "sms" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Send SMS
            </button>
            <button
              type="button"
              disabled={!!sending}
              onClick={() => void handleSend("both")}
              className={rrOutlineBtn}
            >
              {sending === "both" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-emerald-600" />}
              Send Both
            </button>
          </div>
        </div>

        <div className={cn(dashboardCard, "p-3.5")}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className={dashboardCardTitle}>Message preview</h3>
              <p className={`mt-0.5 ${dashboardMicro}`}>
                This is how your message will appear to the customer.
              </p>
            </div>
            <div className="flex rounded-lg border border-zinc-200 p-0.5 text-xs">
              {(["email", "sms"] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, channel: ch }))}
                  className={cn(
                    "rounded-md px-2.5 py-1 font-medium capitalize",
                    (form.channel === ch || (form.channel === "both" && ch === "email")) &&
                      "bg-emerald-600 text-white"
                  )}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
            {form.channel === "email" || form.channel === "both" ? (
              <div className="space-y-2.5 text-[13px]">
                <p className="font-semibold text-zinc-900">
                  {emailTemplate?.subject ?? "We'd love your feedback!"}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed text-zinc-700">{previewBody}</p>
                <div className="pt-2 text-center">
                  <span className="inline-block rounded-full bg-[#137752] px-4 py-2 text-[13px] font-semibold text-white">
                    Leave a review on Google
                  </span>
                </div>
                <p className="text-xs text-zinc-500">Thank you again, {businessName}</p>
                <p className="text-xs text-zinc-400">We value your feedback!</p>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">{previewBody}</p>
            )}
          </div>
        </div>
      </div>

      <div className={cn(dashboardCard, "overflow-hidden")}>
        <div className="border-b border-zinc-100 px-3.5 py-2.5">
          <h3 className={dashboardCardTitle}>Recent sends</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-[12px]">
            <thead className="bg-zinc-50 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3.5 py-2">Customer</th>
                <th className="px-3.5 py-2">Channel</th>
                <th className="px-3.5 py-2">Recipient</th>
                <th className="px-3.5 py-2">Status</th>
                <th className="px-3.5 py-2">Sent</th>
                <th className="px-3.5 py-2">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(stats?.recent_sends ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[13px] text-zinc-500">
                    No sends yet.
                  </td>
                </tr>
              ) : (
                stats?.recent_sends.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50/80">
                    <td className="px-3.5 py-2 font-medium text-zinc-900">
                      {row.review_request_contacts?.customer_name ?? "—"}
                    </td>
                    <td className="px-3.5 py-2">
                      <span className="inline-flex items-center gap-1.5 text-zinc-700">
                        {row.channel === "email" ? (
                          <Mail className="h-3.5 w-3.5 text-violet-500" />
                        ) : (
                          <MessageSquare className="h-3.5 w-3.5 text-sky-500" />
                        )}
                        <span className="capitalize text-xs">{row.channel}</span>
                      </span>
                    </td>
                    <td className="px-3.5 py-2 text-zinc-500">
                      {row.recipient_email ?? row.recipient_phone ?? "—"}
                    </td>
                    <td className="px-3.5 py-2">
                      {statusPill(sendStatusKey(row.status, row.has_reply), row.has_reply)}
                    </td>
                    <td className="px-3.5 py-2 text-zinc-500">
                      {formatSentAt(row.sent_at ?? row.created_at)}
                    </td>
                    <td className="max-w-[200px] truncate px-3.5 py-2 text-zinc-500" title={row.message_body}>
                      {row.message_body.slice(0, 60)}
                      {row.message_body.length > 60 ? "…" : ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
