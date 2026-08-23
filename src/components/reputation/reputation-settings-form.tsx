"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MapPin,
  QrCode,
  Save,
  SearchCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ReputationSettings = {
  businessId: string;
  businessName: string;
  placeId: string;
  reviewLink: string | null;
  shortReviewLink: string | null;
  reviewLinkPlaceId: string | null;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  defaultSenderName: string;
  defaultSenderEmail: string;
  defaultSenderPhone: string;
  smsComplianceStatus: string;
  emailSenderName: string;
  emailFromAddress: string;
  reviewDetectionMatchDays: number;
  reviewDetectionNameFuzzy: boolean;
  dataRetentionDays: number;
};

const TIMEZONE_OPTIONS = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "UTC",
];

const SMS_STATUS_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "not_started", label: "Not started" },
  { value: "pending", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "disabled", label: "Disabled" },
];

const cardClass = "rounded-lg border border-zinc-200 bg-white p-3 shadow-sm";
const labelClass = "text-[12px] font-medium text-zinc-700";
const helpClass = "mt-0.5 text-[11px] leading-relaxed text-zinc-500";
const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] text-zinc-900 outline-none transition focus:border-[#137752] focus:ring-2 focus:ring-[#137752]/10 disabled:bg-zinc-50";

function normalizeTime(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 5);
}

function statusBadgeClass(status: string) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "rejected" || status === "disabled") {
    return "border-red-200 bg-red-50 text-red-700";
  }
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

function Section({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className={cardClass}>
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#137752]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold text-zinc-900">{title}</h3>
          <p className={helpClass}>{description}</p>
          <div className="mt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {help ? <p className={helpClass}>{help}</p> : null}
      {children}
    </label>
  );
}

export function ReputationSettingsForm({ businessId }: { businessId: string }) {
  const [settings, setSettings] = useState<ReputationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const res = await fetch(`/api/reputation/settings?businessId=${encodeURIComponent(businessId)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load settings");
        if (cancelled) return;
        setSettings({
          ...json.settings,
          quietHoursStart: normalizeTime(json.settings.quietHoursStart),
          quietHoursEnd: normalizeTime(json.settings.quietHoursEnd),
        });
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const timezoneOptions = useMemo(() => {
    const current = settings?.timezone;
    if (current && !TIMEZONE_OPTIONS.includes(current)) return [current, ...TIMEZONE_OPTIONS];
    return TIMEZONE_OPTIONS;
  }, [settings?.timezone]);

  const displayReviewLink = settings?.shortReviewLink
    ? `reviews.mapsgrowth.app/${settings.shortReviewLink}`
    : settings?.reviewLink;

  function patch(update: Partial<ReputationSettings>) {
    setSettings((current) => (current ? { ...current, ...update } : current));
  }

  async function copyReviewLink() {
    if (!settings?.reviewLink) return;
    await navigator.clipboard.writeText(settings.reviewLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/reputation/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          placeId: settings.placeId,
          timezone: settings.timezone,
          quietHoursStart: settings.quietHoursStart,
          quietHoursEnd: settings.quietHoursEnd,
          defaultSenderName: settings.defaultSenderName,
          defaultSenderEmail: settings.defaultSenderEmail,
          defaultSenderPhone: settings.defaultSenderPhone,
          smsComplianceStatus: settings.smsComplianceStatus,
          emailSenderName: settings.emailSenderName,
          emailFromAddress: settings.emailFromAddress,
          reviewDetectionMatchDays: settings.reviewDetectionMatchDays,
          reviewDetectionNameFuzzy: settings.reviewDetectionNameFuzzy,
          dataRetentionDays: settings.dataRetentionDays,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setSettings({
        ...json.settings,
        quietHoursStart: normalizeTime(json.settings.quietHoursStart),
        quietHoursEnd: normalizeTime(json.settings.quietHoursEnd),
      });
      setMessage("Reputation settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !settings) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-[12px] text-zinc-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading reputation settings...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
        {error ?? "Unable to load reputation settings."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-zinc-200 bg-white p-3">
        <div>
          <p className="text-[13px] font-semibold text-zinc-900">Reputation configuration</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Business-level defaults used by review requests, detection, compliance, and reporting.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-full bg-[#137752] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0f6344] disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save settings
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {message}
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-2">
        <Section
          icon={MapPin}
          title="Google Business Profile"
          description="Confirm the GBP place used for review links and review detection."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Google Place ID" help="Used by review-link generation and GBP review pulls.">
              <input
                className={inputClass}
                value={settings.placeId}
                onChange={(e) => patch({ placeId: e.target.value })}
                placeholder="ChIJ..."
              />
            </Field>
            <Field label="Review link place ID" help="Place ID stored on the active review link, if one exists.">
              <input
                className={cn(inputClass, "bg-zinc-50 text-zinc-500")}
                value={settings.reviewLinkPlaceId ?? ""}
                readOnly
                placeholder="No active review link"
              />
            </Field>
          </div>

          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-[#137752]" />
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-zinc-800">Active review link</p>
                  {settings.reviewLink ? (
                    <a
                      href={settings.reviewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-[12px] text-[#137752] hover:underline"
                    >
                      {displayReviewLink}
                    </a>
                  ) : (
                    <p className="text-[12px] text-zinc-500">No active review link yet.</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void copyReviewLink()}
                  disabled={!settings.reviewLink}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? "Copied" : "Copy"}
                </button>
                {settings.reviewLink ? (
                  <a
                    href={settings.reviewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </Section>

        <Section
          icon={QrCode}
          title="Review link and QR code"
          description="QR colors, poster copy, short link, and downloads live on the dedicated QR Poster page."
        >
          <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/60 p-3 text-[12px] text-emerald-800">
            <p>
              Open QR Poster to generate or update the active review link, QR code, brand colors, and
              printable poster.
            </p>
            <a
              href={`/businesses/${businessId}/reputation/qr`}
              className="mt-2 inline-flex font-semibold text-[#137752] hover:underline"
            >
              Open QR Poster →
            </a>
          </div>
        </Section>

        <Section
          icon={Clock}
          title="Timezone and quiet hours"
          description="Controls local scheduling windows, alert summaries, and customer-safe send windows."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Business timezone">
              <select
                className={inputClass}
                value={settings.timezone}
                onChange={(e) => patch({ timezone: e.target.value })}
              >
                {timezoneOptions.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quiet hours start">
              <input
                type="time"
                className={inputClass}
                value={settings.quietHoursStart}
                onChange={(e) => patch({ quietHoursStart: e.target.value })}
              />
            </Field>
            <Field label="Quiet hours end">
              <input
                type="time"
                className={inputClass}
                value={settings.quietHoursEnd}
                onChange={(e) => patch({ quietHoursEnd: e.target.value })}
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={() => patch({ quietHoursStart: "", quietHoursEnd: "" })}
            className="mt-3 text-[11px] font-semibold text-[#137752] hover:underline"
          >
            Clear quiet hours
          </button>
        </Section>

        <Section
          icon={UserRound}
          title="Default sender information"
          description="Fallback identity for manually sent review requests and generated templates."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Sender name">
              <input
                className={inputClass}
                value={settings.defaultSenderName}
                onChange={(e) => patch({ defaultSenderName: e.target.value })}
                placeholder={settings.businessName}
              />
            </Field>
            <Field label="Sender email">
              <input
                type="email"
                className={inputClass}
                value={settings.defaultSenderEmail}
                onChange={(e) => patch({ defaultSenderEmail: e.target.value })}
                placeholder="owner@example.com"
              />
            </Field>
            <Field label="Sender phone">
              <input
                type="tel"
                className={inputClass}
                value={settings.defaultSenderPhone}
                onChange={(e) => patch({ defaultSenderPhone: e.target.value })}
                placeholder="+1 555 123 4567"
              />
            </Field>
          </div>
        </Section>

        <Section
          icon={ShieldCheck}
          title="SMS compliance status"
          description="Track whether the business is eligible to send SMS review requests."
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field label="Compliance status">
              <select
                className={inputClass}
                value={settings.smsComplianceStatus}
                onChange={(e) => patch({ smsComplianceStatus: e.target.value })}
              >
                {SMS_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-1.5 text-[11px] font-semibold capitalize",
                statusBadgeClass(settings.smsComplianceStatus)
              )}
            >
              {settings.smsComplianceStatus.replace(/_/g, " ")}
            </span>
          </div>
        </Section>

        <Section
          icon={Mail}
          title="Email sender settings"
          description="Default From identity for email review requests."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email sender name">
              <input
                className={inputClass}
                value={settings.emailSenderName}
                onChange={(e) => patch({ emailSenderName: e.target.value })}
                placeholder={settings.defaultSenderName || settings.businessName}
              />
            </Field>
            <Field label="From email address">
              <input
                type="email"
                className={inputClass}
                value={settings.emailFromAddress}
                onChange={(e) => patch({ emailFromAddress: e.target.value })}
                placeholder="reviews@example.com"
              />
            </Field>
          </div>
        </Section>

        <Section
          icon={SearchCheck}
          title="Review-detection matching rules"
          description="Controls how long campaign sends can match newly detected Google reviews."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Matching window (days)">
              <input
                type="number"
                min={1}
                max={365}
                className={inputClass}
                value={settings.reviewDetectionMatchDays}
                onChange={(e) =>
                  patch({ reviewDetectionMatchDays: Math.max(1, Number(e.target.value) || 14) })
                }
              />
            </Field>
            <label className="mt-6 flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={settings.reviewDetectionNameFuzzy}
                onChange={(e) => patch({ reviewDetectionNameFuzzy: e.target.checked })}
              />
              <span>
                <span className="block text-[12px] font-medium text-zinc-800">
                  Allow fuzzy customer-name matching
                </span>
                <span className="block text-[11px] text-zinc-500">
                  Helps attribute reviews when Google shortens or formats reviewer names differently.
                </span>
              </span>
            </label>
          </div>
        </Section>

        <Section
          icon={Database}
          title="Data-retention settings"
          description="Default retention horizon for reputation request and detection data."
        >
          <div className="max-w-xs">
            <Field label="Retain reputation data for">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={30}
                  max={3650}
                  className={inputClass}
                  value={settings.dataRetentionDays}
                  onChange={(e) => patch({ dataRetentionDays: Math.max(30, Number(e.target.value) || 730) })}
                />
                <span className="mt-1 text-[12px] text-zinc-500">days</span>
              </div>
            </Field>
          </div>
        </Section>
      </div>
    </div>
  );
}
