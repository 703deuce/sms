"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  FileText,
  History,
  Mail,
  MessageSquare,
  MousePointerClick,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Upload,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MessagingSetupCallout } from "@/components/messaging/messaging-setup-callout";
import { ReviewRequestsPanel } from "@/components/reputation/review-requests-panel";
import type { ReviewRequestsSection } from "@/components/reputation/review-requests-sub-tabs";
import type { CampaignRow } from "@/components/reputation/review-requests-campaigns";
import {
  RepBadge,
  RepPageHeader,
  RepTabs,
  rep,
} from "@/components/reputation/rep-ui";
import { ModulePage } from "@/components/ui/design-system";
import { renderTemplate } from "@/lib/reputation/template-vars";
import type { PosterConfig } from "@/lib/reputation/poster-config";
import { cn } from "@/lib/utils";

type RequestTab = "send" | "bulk" | "qr" | "link";

type TemplateRow = {
  id: string;
  channel: string;
  name: string;
  subject?: string | null;
  body: string;
  is_default?: boolean;
  bestUsed?: string;
  avgConversion?: number;
  charCount?: number;
};

type ContactRow = {
  id: string;
  name: string;
  phone: string;
  lastService: string;
  tags: string[];
};

type KitData = {
  businessName: string;
  placeId: string | null;
  sendFromNumber?: string;
  sendFromVerified?: boolean;
  eligibleCount?: number;
  selectedContacts?: ContactRow[];
  link: {
    id: string;
    review_url: string;
    short_url?: string | null;
    place_id?: string;
    poster_config?: PosterConfig;
  } | null;
  posterConfig: PosterConfig;
  mapsFallbackUrl: string | null;
  warning: string | null;
  templates: TemplateRow[];
  events: Array<{ id: string; event_type: string; channel?: string | null; created_at: string }>;
  keywordSuggestions: Array<{ id?: string; keyword: string; keyword_type?: string; gap?: number }>;
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
  has_reply?: boolean;
  review_request_contacts?: { customer_name?: string | null } | null;
};

type Stats = {
  total_sent: number;
  total_sent_trend?: number;
  email_sent: number;
  sms_sent: number;
  manual_sent: number;
  failed: number;
  delivery_rate?: number;
  delivery_rate_trend?: number;
  last_7_days: number;
  last_7_days_trend?: number;
  last_30_days: number;
  replies?: number;
  reviews_generated?: number;
  reviews_generated_trend?: number;
  review_link_clicks?: number;
  review_link_clicks_trend?: number;
  conversion_rate?: number;
  conversion_rate_trend?: number;
  recent_sends: SendRow[];
  trial_sms_template?: string | null;
};

export type ReviewRequestsDashboardPreviewData = {
  kit: KitData;
  stats?: Stats | null;
  campaigns?: CampaignRow[];
};

const TABS: Array<{ id: RequestTab; label: string }> = [
  { id: "send", label: "One-Time Send" },
  { id: "bulk", label: "Bulk Send" },
  { id: "qr", label: "QR Code" },
  { id: "link", label: "Link & Share" },
];

function parseTab(value: string | null): RequestTab {
  if (value === "bulk") return "bulk";
  if (value === "poster" || value === "qr") return "qr";
  if (value === "messages" || value === "templates" || value === "link") return "link";
  return "send";
}

function panelSectionForTab(tab: RequestTab): ReviewRequestsSection {
  if (tab === "bulk") return "bulk";
  if (tab === "link") return "poster";
  if (tab === "qr") return "poster";
  return "send";
}

function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toLocaleString();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function TrendChip({ value, positive = true }: { value: number | undefined; positive?: boolean }) {
  if (value == null) return null;
  const isPositive = positive ? value >= 0 : value <= 0;
  return (
    <span className={cn("mr-1 font-semibold", isPositive ? "text-[#027A48]" : "text-[#B42318]")}>
      {value >= 0 ? "▲" : "▼"}{Math.abs(value)}%
    </span>
  );
}

function KpiCard({
  label,
  value,
  trend,
  trendPositive,
  hint,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: React.ReactNode;
  trend?: number;
  trendPositive?: boolean;
  hint?: string;
  icon: LucideIcon;
  iconClassName?: string;
}) {
  return (
    <div className={cn(rep.card, "p-4")}>
      <div className="flex items-start justify-between gap-2">
        <p className={rep.label}>{label}</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]", iconClassName)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]">{value}</p>
      <p className="mt-2 text-xs text-[#667085]">
        <TrendChip value={trend} positive={trendPositive} />
        {hint}
      </p>
    </div>
  );
}

function SectionCard({
  number,
  title,
  children,
  className,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(rep.card, "p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECFDF3] text-xs font-bold text-[#137752]">
          {number}
        </span>
        <h2 className="text-[15px] font-semibold text-[#101828]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ChannelCard({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
        active
          ? "border-[#137752] bg-[#ECFDF3] shadow-[0_0_0_1px_rgba(19,119,82,0.14)]"
          : "border-[#E6EAF0] bg-white hover:bg-[#F9FAFB]"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-white text-[#137752]" : "bg-[#F2F4F7] text-[#667085]"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#101828]">
          {title}
          {active ? <Check className="h-3.5 w-3.5 text-[#137752]" /> : null}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-[#667085]">{description}</span>
      </span>
    </button>
  );
}

function PhonePreview({
  businessName,
  body,
}: {
  businessName: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-[240px] rounded-[2rem] border-[5px] border-[#101828] bg-[#101828] p-1.5 shadow-xl">
      <div className="overflow-hidden rounded-[1.55rem] bg-[#F2F4F7]">
        <div className="flex items-center justify-between bg-white px-4 py-2 text-[10px] font-semibold text-[#101828]">
          <span>9:41</span>
          <span className="text-[#98A2B3]">5G</span>
        </div>
        <div className="border-b border-[#E6EAF0] bg-white px-4 py-2 text-center">
          <p className="text-[11px] font-semibold text-[#101828]">{businessName}</p>
          <p className="text-[10px] text-[#98A2B3]">Review request · SMS</p>
        </div>
        <div className="min-h-[200px] px-3 py-4">
          <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#344054] shadow-sm">
            {body}
          </div>
        </div>
      </div>
    </div>
  );
}

function downloadCsv(filename: string, rows: string[][]) {
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const csv = rows.map((row) => row.map((cell) => escape(cell)).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function RecipientsTable({
  contacts,
  sends,
  eligibleCount,
}: {
  contacts?: ContactRow[];
  sends: SendRow[];
  eligibleCount?: number;
}) {
  const [showAll, setShowAll] = useState(false);

  if (contacts && contacts.length > 0) {
    const visible = showAll ? contacts : contacts.slice(0, 10);
    return (
      <div className={cn(rep.card, "overflow-hidden")}>
        <div className="flex items-center justify-between gap-3 border-b border-[#E6EAF0] px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#101828]">Recipients</h2>
            <p className="mt-0.5 text-xs text-[#667085]">
              {contacts.length} selected
              {eligibleCount ? ` of ${eligibleCount} eligible` : ""}
            </p>
          </div>
          <button
            type="button"
            className={rep.btnSecondary}
            onClick={() =>
              downloadCsv("recipients.csv", [
                ["Name", "Phone", "Last Service", "Tags"],
                ...contacts.map((c) => [c.name, c.phone, c.lastService, c.tags.join("|")]),
              ])
            }
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Phone</th>
                <th className="px-4 py-2 font-semibold">Last Service</th>
                <th className="px-4 py-2 font-semibold">Tags</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((contact) => (
                <tr key={contact.id} className="border-b border-[#F2F4F7] last:border-0">
                  <td className="px-4 py-3 font-semibold text-[#101828]">{contact.name}</td>
                  <td className="px-4 py-3 text-[#667085]">{contact.phone}</td>
                  <td className="px-4 py-3 text-[#344054]">{contact.lastService}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.slice(0, 2).map((tag) => (
                        <RepBadge key={tag} tone="green">{tag}</RepBadge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {contacts.length > 10 ? (
          <div className="border-t border-[#E6EAF0] px-4 py-2.5 text-center">
            <button type="button" className={rep.link} onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer recipients" : `View all ${contacts.length} recipients`}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn(rep.card, "overflow-hidden")}>
      <div className="flex items-center justify-between gap-3 border-b border-[#E6EAF0] px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#101828]">Recent Recipients</h2>
          <p className="mt-0.5 text-xs text-[#667085]">Recent recipients and delivery status.</p>
        </div>
        <button
          type="button"
          className={rep.btnSecondary}
          disabled={sends.length === 0}
          onClick={() =>
            downloadCsv("recent-recipients.csv", [
              ["Customer", "Channel", "Status", "Sent"],
              ...sends.map((s) => [
                s.review_request_contacts?.customer_name ?? "Unknown",
                s.channel ?? "—",
                s.status ?? "—",
                s.sent_at ?? s.created_at ?? "—",
              ]),
            ])
          }
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#E6EAF0] bg-[#F9FAFB] text-[11px] uppercase tracking-[0.06em] text-[#98A2B3]">
              <th className="px-4 py-2 font-semibold">Customer</th>
              <th className="px-4 py-2 font-semibold">Channel</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              <th className="px-4 py-2 font-semibold">Sent</th>
            </tr>
          </thead>
          <tbody>
            {sends.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-[#667085]">
                  No recent recipients yet.
                </td>
              </tr>
            ) : (
              sends.slice(0, 8).map((send) => (
                <tr key={send.id} className="border-b border-[#F2F4F7] last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#101828]">
                      {send.review_request_contacts?.customer_name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-[#667085]">{send.recipient_email ?? send.recipient_phone ?? "--"}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-[#344054]">{send.channel}</td>
                  <td className="px-4 py-3">
                    <RepBadge tone={send.status === "failed" ? "red" : send.has_reply ? "blue" : "green"}>
                      {send.has_reply ? "Replied" : send.status}
                    </RepBadge>
                  </td>
                  <td className="px-4 py-3 text-[#667085]">{formatDate(send.sent_at ?? send.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OneTimeSend({
  businessId,
  data,
  stats,
  loading,
  onRefresh,
  onOpenBulk,
}: {
  businessId: string;
  data: KitData | null;
  stats: Stats | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOpenBulk: () => void;
}) {
  const [form, setForm] = useState({
    audienceMode: "select" as "select" | "import",
    tagFilter: "",
    channel: "sms" as "sms" | "email",
    templateId: "",
    schedule: "now" as "now" | "later",
  });
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  void sending;
  void onRefresh;

  const templates = data?.templates ?? [];
  const smsTemplates = templates.filter((t) => t.channel === "sms");
  const emailTemplates = templates.filter((t) => t.channel === "email");
  const channelTemplates = form.channel === "sms" ? smsTemplates : emailTemplates;
  const fallbackTemplate =
    channelTemplates.find((t) => t.is_default) ?? channelTemplates[0] ?? templates[0];
  const selectedTemplate =
    templates.find((t) => t.id === form.templateId) ?? fallbackTemplate;
  const reviewUrl = data?.link?.review_url ?? null;
  const previewBody = selectedTemplate
    ? renderTemplate(selectedTemplate.body, {
        customer_name: "James",
        first_name: "James",
        business_name: data?.businessName ?? "your business",
        review_link: reviewUrl ?? "https://g.page/r/review",
        service_type: "Junk Removal",
      })
    : "Hi James! Thanks for choosing Premier Junk Removal. We'd love your Google review: https://g.page/r/review 🙏";

  const contacts = data?.selectedContacts ?? [];
  const eligibleCount = data?.eligibleCount ?? 0;
  const selectedCount = contacts.length;

  const kpiSent = stats?.total_sent ?? null;
  const kpiDelivery = stats?.delivery_rate ?? null;
  const kpiReviews = stats?.reviews_generated ?? null;
  const kpiConversion = stats?.conversion_rate ?? null;
  const kpiClicks = stats?.review_link_clicks ?? null;

  async function handleSend() {
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setMessage(`Review request sent to ${selectedCount} contacts.`);
    } catch {
      setError("Send failed. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Requests Sent"
          value={loading ? "--" : formatNumber(kpiSent)}
          trend={stats?.total_sent_trend}
          hint="Last 30 days"
          icon={Send}
        />
        <KpiCard
          label="Delivery Rate"
          value={loading ? "--" : kpiDelivery != null ? `${kpiDelivery}%` : "--"}
          trend={stats?.delivery_rate_trend}
          hint="Delivered / attempted"
          icon={ShieldCheck}
          iconClassName="bg-[#EFF8FF] text-[#175CD3]"
        />
        <KpiCard
          label="Reviews Generated"
          value={loading ? "--" : formatNumber(kpiReviews)}
          trend={stats?.reviews_generated_trend}
          hint="Last 30 days"
          icon={Sparkles}
          iconClassName="bg-[#FFFAEB] text-[#B54708]"
        />
        <KpiCard
          label="Conversion Rate"
          value={loading ? "--" : kpiConversion != null ? `${kpiConversion}%` : "--"}
          trend={stats?.conversion_rate_trend}
          hint="Reviews / requests sent"
          icon={MousePointerClick}
          iconClassName="bg-[#F4F3FF] text-[#5925DC]"
        />
        <KpiCard
          label="Link Clicks"
          value={loading ? "--" : formatNumber(kpiClicks)}
          trend={stats?.review_link_clicks_trend ?? stats?.last_7_days_trend}
          hint="Tracked review link clicks"
          icon={RefreshCw}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* LEFT wizard */}
        <div className="space-y-4">
          {error ? <div className="rounded-xl border border-[#FDA29B] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318]">{error}</div> : null}
          {message ? <div className="rounded-xl border border-[#ABEFC6] bg-[#ECFDF3] px-4 py-3 text-sm text-[#027A48]">{message}</div> : null}

          {/* Step 1: Who are you sending to? */}
          <SectionCard number={1} title="Who are you sending to?">
            <div className="space-y-3">
              <div className="flex gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#344054]">
                  <input
                    type="radio"
                    name="audienceMode"
                    value="select"
                    checked={form.audienceMode === "select"}
                    onChange={() => setForm((f) => ({ ...f, audienceMode: "select" }))}
                    className="accent-[#137752]"
                  />
                  Select Contacts
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#344054]">
                  <input
                    type="radio"
                    name="audienceMode"
                    value="import"
                    checked={form.audienceMode === "import"}
                    onChange={() => setForm((f) => ({ ...f, audienceMode: "import" }))}
                    className="accent-[#137752]"
                  />
                  Import New
                </label>
              </div>

              {form.audienceMode === "select" ? (
                <>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select className={cn(rep.select, "w-full pr-8")}>
                        <option>Eligible for request ({eligibleCount || 156})</option>
                        <option>All contacts</option>
                        <option>Recent completions — last 30 days</option>
                      </select>
                    </div>
                  </div>
                  <div className="relative">
                    <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                    <input
                      type="text"
                      placeholder="Filter by tags (e.g. Completed, No Request Sent)"
                      value={form.tagFilter}
                      onChange={(e) => setForm((f) => ({ ...f, tagFilter: e.target.value }))}
                      className={cn(rep.input, "pl-9")}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-[#D1FADF] bg-[#ECFDF3] px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#137752]" />
                      <span className="text-sm font-semibold text-[#027A48]">
                        {selectedCount} Contacts selected
                      </span>
                    </div>
                    <button type="button" className={rep.link}>
                      View recipients
                    </button>
                  </div>
                </>
              ) : (
                <button type="button" className={rep.btnSecondary} onClick={onOpenBulk}>
                  <Upload className="h-4 w-4" />
                  Upload CSV
                </button>
              )}
            </div>
          </SectionCard>

          {/* Step 2: Channel */}
          <SectionCard number={2} title="Choose your channel">
            <div className="grid gap-3 md:grid-cols-2">
              <ChannelCard
                active={form.channel === "sms"}
                icon={MessageSquare}
                title="SMS"
                description="Best for immediate follow-up. ~98% open rate."
                onClick={() => setForm((f) => ({ ...f, channel: "sms" }))}
              />
              <ChannelCard
                active={form.channel === "email"}
                icon={Mail}
                title="Email"
                description="Longer note with review CTA. No character limit."
                onClick={() => setForm((f) => ({ ...f, channel: "email" }))}
              />
            </div>
            {form.channel === "sms" ? (
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                  Send from
                </label>
                <div className="flex items-center gap-2">
                  <select className={cn(rep.select, "flex-1")}>
                    <option>{data?.sendFromNumber ?? "+1 (571) 555-0199"}</option>
                    <option>Shared number pool</option>
                  </select>
                  {data?.sendFromVerified ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-[#027A48]">
                      <Check className="h-3.5 w-3.5" /> Verified
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-[#667085]">
                  SMS includes opt-out language (Reply STOP to unsubscribe) as required by TCPA.
                </p>
              </div>
            ) : null}
          </SectionCard>

          {/* Step 3: Template */}
          <SectionCard number={3} title="Choose a template">
            <div className="space-y-3">
              <div className="flex gap-2">
                <select
                  value={selectedTemplate?.id ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
                  className={cn(rep.select, "flex-1")}
                >
                  {channelTemplates.length === 0 ? <option>No templates available</option> : null}
                  {channelTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Link
                  href={`/businesses/${businessId}/reputation/templates`}
                  className={rep.btnSecondary}
                >
                  Manage Templates
                </Link>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                  Merge fields
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["{first_name}", "{business_name}", "{review_link}"].map((token) => (
                    <span
                      key={token}
                      className="rounded-full border border-[#E6EAF0] bg-[#F9FAFB] px-2 py-1 text-[11px] font-semibold text-[#344054]"
                    >
                      {token}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Step 5: Send or schedule */}
          <SectionCard number={5} title="Send or schedule">
            <div className="space-y-3">
              <div className="flex gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#344054]">
                  <input
                    type="radio"
                    name="schedule"
                    value="now"
                    checked={form.schedule === "now"}
                    onChange={() => setForm((f) => ({ ...f, schedule: "now" }))}
                    className="accent-[#137752]"
                  />
                  Send now
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#344054]">
                  <input
                    type="radio"
                    name="schedule"
                    value="later"
                    checked={form.schedule === "later"}
                    onChange={() => setForm((f) => ({ ...f, schedule: "later" }))}
                    className="accent-[#137752]"
                  />
                  Schedule for later
                </label>
              </div>
              {form.schedule === "later" ? (
                <input type="datetime-local" className={rep.input} />
              ) : null}
              <button
                type="button"
                onClick={() => void handleSend()}
                className={cn(rep.btnPrimary, "w-full justify-center py-3 text-base")}
              >
                <Send className="h-5 w-5" />
                {form.schedule === "now"
                  ? `Send Now to ${selectedCount} Contacts`
                  : `Schedule for ${selectedCount} Contacts`}
              </button>
              <p className="text-center text-xs text-[#667085]">
                Estimated cost:{" "}
                <span className="font-semibold text-[#101828]">
                  {form.channel === "email" ? "Free" : `${selectedCount} SMS credits`}
                </span>
              </p>
            </div>
          </SectionCard>
        </div>

        {/* RIGHT: Preview + Recipients */}
        <aside className="space-y-4">
          {/* Step 4: Preview */}
          <section className={cn(rep.card, "p-4")}>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ECFDF3] text-xs font-bold text-[#137752]">
                4
              </span>
              <h2 className="text-[15px] font-semibold text-[#101828]">Preview</h2>
            </div>
            <PhonePreview businessName={data?.businessName ?? "Your business"} body={previewBody} />

            {selectedTemplate ? (
              <div className="mt-4 rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                  About this template
                </p>
                <div className="mt-2 space-y-2">
                  {selectedTemplate.bestUsed ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#667085]">Best used</span>
                      <span className="font-semibold text-[#344054]">{selectedTemplate.bestUsed}</span>
                    </div>
                  ) : null}
                  {selectedTemplate.avgConversion != null ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#667085]">Avg conversion</span>
                      <span className="font-semibold text-[#027A48]">{selectedTemplate.avgConversion}%</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#667085]">Character count</span>
                    <span className={cn("font-semibold", (selectedTemplate.charCount ?? previewBody.length) > 160 ? "text-[#B54708]" : "text-[#344054]")}>
                      {selectedTemplate.charCount ?? previewBody.length}/160
                    </span>
                  </div>
                </div>
                <Link
                  href={`/businesses/${businessId}/reputation/templates`}
                  className={cn(rep.link, "mt-3 text-xs")}
                >
                  Edit Message
                </Link>
              </div>
            ) : null}
          </section>

          <RecipientsTable
            contacts={data?.selectedContacts}
            sends={stats?.recent_sends ?? []}
            eligibleCount={data?.eligibleCount}
          />
        </aside>
      </div>

      {/* Bottom tip cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Personalized Messages", body: "Merge fields make requests feel hand-written and consistently improve response rates by 20–30%.", icon: Sparkles },
          { title: "Track Results", body: "Monitor delivery, link clicks, replies, and attributed reviews from one dashboard.", icon: MousePointerClick },
          { title: "Stay Compliant", body: "Only send to eligible customers. SMS includes opt-out language per TCPA requirements.", icon: ShieldCheck },
        ].map((tip) => (
          <div key={tip.title} className={cn(rep.card, "p-4")}>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ECFDF3]">
              <tip.icon className="h-4 w-4 text-[#137752]" />
            </span>
            <h3 className="mt-3 text-sm font-semibold text-[#101828]">{tip.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-[#667085]">{tip.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkSharePanel({
  data,
  businessId,
  previewData,
}: {
  data: KitData | null;
  businessId: string;
  previewData?: ReviewRequestsDashboardPreviewData;
}) {
  const reviewUrl = data?.link?.review_url ?? null;
  const shortUrl = data?.link?.short_url ? `reviews.mapsgrowth.app/${data.link.short_url}` : null;

  return (
    <div className="space-y-4">
      <div className={cn(rep.card, "p-4")}>
        <h2 className="text-[15px] font-semibold text-[#101828]">Shareable Review Link</h2>
        <p className="mt-1 text-sm text-[#667085]">Copy this link into invoices, follow-up emails, or team scripts.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input readOnly value={shortUrl ?? reviewUrl ?? "Generate a review link first"} className={cn(rep.input, "min-w-[260px] flex-1")} />
          <button
            type="button"
            className={rep.btnPrimary}
            onClick={() => {
              if (reviewUrl) void navigator.clipboard.writeText(reviewUrl);
            }}
          >
            <Copy className="h-4 w-4" />
            Copy Link
          </button>
        </div>
      </div>
      <ReviewRequestsPanel businessId={businessId} section="messages" hideSubTabs previewData={previewData} />
    </div>
  );
}

export function ReviewRequestsDashboard({
  businessId,
  previewData,
}: {
  businessId: string;
  previewData?: ReviewRequestsDashboardPreviewData;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<RequestTab>(() => parseTab(searchParams.get("tab")));
  const [data, setData] = useState<KitData | null>(previewData?.kit ?? null);
  const [stats, setStats] = useState<Stats | null>(previewData?.stats ?? null);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setTab(parseTab(searchParams.get("tab"))));
  }, [searchParams]);

  const load = useCallback(async () => {
    if (previewData) return;
    setLoading(true);
    setError(null);
    try {
      const [kitRes, statsRes] = await Promise.all([
        fetch(`/api/reputation/review-link/${businessId}`),
        fetch(`/api/reputation/review-requests/stats/${businessId}`),
      ]);
      const kitJson = await kitRes.json().catch(() => ({}));
      const statsJson = await statsRes.json().catch(() => ({}));
      if (!kitRes.ok) throw new Error(kitJson.error ?? "Failed to load review link");
      setData(kitJson);
      setStats(statsRes.ok ? statsJson : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load review requests");
      setData(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [businessId, previewData]);

  useEffect(() => {
    if (previewData) return;
    queueMicrotask(() => void load());
  }, [load, previewData]);

  const handleTabChange = useCallback(
    (next: string) => {
      const nextTab = next as RequestTab;
      setTab(nextTab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", nextTab);
      router.replace(`/businesses/${businessId}/reputation/requests?${params.toString()}`, {
        scroll: false,
      });
    },
    [businessId, router, searchParams]
  );

  return (
    <ModulePage className={rep.page}>
      <RepPageHeader
        title="Review Requests"
        subtitle="Send review requests to your customers and track results."
        showExport={false}
        showFilters={false}
        actions={
          <>
            <button
              type="button"
              className={rep.btnSecondary}
              onClick={() => handleTabChange("send")}
              title="Use the one-time send wizard below"
            >
              How it works
            </button>
            <Link
              href={`/businesses/${businessId}/reputation/templates`}
              className={rep.btnSecondary}
            >
              <FileText className="h-4 w-4" />
              Templates
              <ChevronDown className="h-3.5 w-3.5" />
            </Link>
          </>
        }
        primaryAction={
          <Link
            href={`/businesses/${businessId}/reputation/campaigns`}
            className={rep.btnPrimary}
          >
            <History className="h-4 w-4" />
            History
          </Link>
        }
      />

      <MessagingSetupCallout businessId={businessId} />

      <RepTabs tabs={TABS} active={tab} onChange={handleTabChange} />

      {error ? (
        <div className="rounded-xl border border-[#FDA29B] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318]">{error}</div>
      ) : null}

      {tab === "send" ? (
        <OneTimeSend
          businessId={businessId}
          data={data}
          stats={stats}
          loading={loading}
          onRefresh={load}
          onOpenBulk={() => handleTabChange("bulk")}
        />
      ) : null}

      {tab === "bulk" ? (
        <ReviewRequestsPanel
          businessId={businessId}
          section={panelSectionForTab(tab)}
          hideSubTabs
          previewData={previewData}
        />
      ) : null}

      {tab === "qr" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3">
            <p className="text-sm text-[#027A48]">
              The printable QR poster lives on its own page so you can customize colors, headline, and
              downloads without mixing it into one-time sends.
            </p>
            <Link
              href={`/businesses/${businessId}/reputation/qr`}
              className={rep.btnPrimary}
            >
              Open QR Poster
            </Link>
          </div>
          <ReviewRequestsPanel businessId={businessId} section="poster" hideSubTabs previewData={previewData} />
        </div>
      ) : null}

      {tab === "link" ? (
        <LinkSharePanel businessId={businessId} data={data} previewData={previewData} />
      ) : null}
    </ModulePage>
  );
}
