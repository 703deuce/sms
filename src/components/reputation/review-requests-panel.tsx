"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { Copy, Download, ExternalLink, Loader2, Link2, Send, Sparkles, Check, Shield, Mail, MessageSquare, X, ArrowLeftRight, Search, Info, Smile } from "lucide-react";
import { renderTemplate } from "@/lib/reputation/template-vars";
import {
  DEFAULT_POSTER_CONFIG,
  POSTER_BRAND_COLORS,
  type PosterConfig,
} from "@/lib/reputation/poster-config";
import { ReviewPosterPreview } from "@/components/reputation/review-poster-preview";
import { ReviewRequestsSendSection } from "@/components/reputation/review-requests-send-section";
import { ReviewRequestsBulkWizard } from "@/components/reputation/review-requests-bulk-wizard";
import {
  ReviewRequestsCampaignsTable,
  type CampaignRow,
} from "@/components/reputation/review-requests-campaigns";
import { ReviewRequestRepliesPanel, type ReviewReplyRow } from "@/components/reputation/review-request-replies";
import type { ReviewRequestsSection } from "@/components/reputation/review-requests-sub-tabs";
import { statusPill, rrInputClass, rrLabelClass, rrOutlineBtn, rrPrimaryBtn } from "@/components/reputation/review-requests-ui";
import {
  pctOfTotal,
  responseRate,
  ReviewRequestsKpiCard,
  ReviewRequestsKpiRow as KpiRow,
} from "@/components/reputation/review-requests-kpi-cards";
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
  name: string;
  subject?: string | null;
  body: string;
  is_default?: boolean;
};

type EventRow = {
  id: string;
  event_type: string;
  channel?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  service_type?: string | null;
  notes?: string | null;
  created_at: string;
  send_id?: string | null;
  metadata?: Record<string, unknown>;
};

type KitData = {
  businessName: string;
  placeId: string | null;
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
  events: EventRow[];
  keywordSuggestions: Array<{ id?: string; keyword: string; keyword_type?: string; gap?: number }>;
};

type ReviewRequestsPanelStats = {
  total_sent: number;
  email_sent: number;
  sms_sent: number;
  manual_sent: number;
  failed: number;
  last_7_days: number;
  last_30_days: number;
  recent_sends: Array<{
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
  }>;
  recent_replies?: ReviewReplyRow[];
  replies?: number;
  inbound_reply_domain?: string | null;
};

export type ReviewRequestsPanelPreviewData = {
  kit: KitData;
  stats?: ReviewRequestsPanelStats | null;
  campaigns?: CampaignRow[];
};

type TemplateChannel = "sms" | "email" | "generic";

function MessageWithLink({
  text,
  linkLabel,
  linkUrl,
  className,
  linkClassName,
}: {
  text: string;
  linkLabel: string;
  linkUrl: string | null;
  className?: string;
  linkClassName?: string;
}) {
  const idx = text.indexOf(linkLabel);
  if (!linkUrl || idx === -1) {
    return <p className={className ?? "whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800"}>{text}</p>;
  }
  return (
    <p className={className ?? "whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800"}>
      {text.slice(0, idx)}
      <a
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName ?? "font-medium text-emerald-700 underline underline-offset-2"}
      >
        {linkLabel}
      </a>
      {text.slice(idx + linkLabel.length)}
    </p>
  );
}

export function ReviewRequestsPanel({
  businessId,
  section: controlledSection,
  hideSubTabs = false,
  previewData,
}: {
  businessId: string;
  section?: ReviewRequestsSection;
  hideSubTabs?: boolean;
  previewData?: ReviewRequestsPanelPreviewData;
}) {
  const [data, setData] = useState<KitData | null>(previewData?.kit ?? null);
  const [loading, setLoading] = useState(!previewData);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [internalSection, setInternalSection] = useState<ReviewRequestsSection>("poster");
  const section = controlledSection ?? internalSection;
  const [templateChannel, setTemplateChannel] = useState<TemplateChannel>("sms");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);

  const [poster, setPoster] = useState<PosterConfig>(previewData?.kit.posterConfig ?? DEFAULT_POSTER_CONFIG);
  const [shortSlug, setShortSlug] = useState(previewData?.kit.link?.short_url ?? "");
  const [manualForm, setManualForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    serviceType: "",
    channel: "sms",
    notes: "",
  });
  const [submittingManual, setSubmittingManual] = useState(false);
  const [stats, setStats] = useState<ReviewRequestsPanelStats | null>(previewData?.stats ?? null);

  const loadStats = useCallback(async () => {
    if (previewData) return;
    try {
      const res = await fetch(`/api/reputation/review-requests/stats/${businessId}`);
      if (res.ok) setStats(await res.json());
    } catch {
      setStats(null);
    }
  }, [businessId, previewData]);

  const load = useCallback(async () => {
    if (previewData) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reputation/review-link/${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
      setPoster(json.posterConfig ?? DEFAULT_POSTER_CONFIG);
      setShortSlug(json.link?.short_url ?? "");
      await loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [businessId, previewData, loadStats]);

  useEffect(() => {
    if (previewData) return;
    queueMicrotask(() => {
      void load();
      void loadStats();
    });
  }, [load, loadStats, previewData]);

  const reviewUrl = data?.link?.review_url ?? null;
  const displayLink = shortSlug ? `reviews.mapsgrowth.app/${shortSlug}` : null;

  useEffect(() => {
    if (!reviewUrl) {
      queueMicrotask(() => setQrDataUrl(null));
      return;
    }
    void QRCode.toDataURL(reviewUrl, { width: 400, margin: 1, color: { dark: "#111827", light: "#ffffff" } }).then(
      setQrDataUrl
    );
  }, [reviewUrl]);

  async function logEvent(params: Record<string, string | undefined>) {
    await fetch("/api/reputation/review-link/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, linkId: data?.link?.id, ...params }),
    });
    await load();
  }

  async function createLink() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/reputation/review-link/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, forceRefresh: !!data?.link }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create link");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  }

  async function savePosterSettings() {
    setSaving(true);
    try {
      const res = await fetch("/api/reputation/review-link/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, shortSlug, posterConfig: poster }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyReviewLink() {
    if (!reviewUrl) return;
    await navigator.clipboard.writeText(reviewUrl);
    setCopied("link");
    setTimeout(() => setCopied(null), 2000);
    await logEvent({ eventType: "copied", channel: "link" });
  }

  async function downloadPoster() {
    if (!posterRef.current) return;
    const dataUrl = await toPng(posterRef.current, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${shortSlug || "review"}-poster.png`;
    a.click();
    await logEvent({ eventType: "qr_downloaded", channel: "poster" });
  }

  function togglePhrase(keyword: string) {
    setPoster((p) => {
      const selected = p.selectedPhrases.includes(keyword)
        ? p.selectedPhrases.filter((k) => k !== keyword)
        : [...p.selectedPhrases, keyword].slice(0, 6);
      return { ...p, selectedPhrases: selected };
    });
  }

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading review request kit…
      </div>
    );
  }

  if (!data?.link) {
    return (
      <div className={cn(dashboardCard, "border-dashed px-3.5 py-8 text-center")}>
        <h3 className={dashboardCardTitle}>Review poster & request kit</h3>
        <p className="mx-auto mt-1.5 max-w-md text-[13px] text-text-muted">
          Generate a Google review link, QR poster, and message templates for your team to send manually.
        </p>
        {data?.warning && (
          <p className="mt-3 text-[13px] text-amber-700">{data.warning}</p>
        )}
        <button
          type="button"
          onClick={() => void createLink()}
          disabled={creating || !!data?.warning}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Generate Review Link
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-800">{error}</div>
      )}

      {!hideSubTabs && (
        <div className="flex flex-wrap gap-1 border-b border-border dark:border-zinc-800">
          {(
            [
              { id: "poster" as const, label: "Review Poster" },
              { id: "messages" as const, label: "Messages" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setInternalSection(t.id)}
                className={`px-3.5 py-2 text-[13px] font-medium ${
                section === t.id
                  ? "border-b-2 border-primary text-primary-muted"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {section === "poster" && (
        <div className={cn(dashboardCard, "overflow-hidden")}>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4 border-b border-zinc-100 p-3 lg:border-b-0 lg:border-r">
              <section className="border-b border-zinc-100 pb-4">
                <h3 className={dashboardCardTitle}>Create a review link</h3>
                <p className={`mt-0.5 ${dashboardMicro}`}>
                  Build a clean link to collect Google reviews and convert more customers.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 overflow-hidden rounded-lg border border-zinc-200">
                  <span className="flex items-center bg-zinc-50 px-3 text-xs text-zinc-500">
                    reviews.mapsgrowth.app/
                  </span>
                  <input
                    type="text"
                    value={shortSlug}
                    onChange={(e) => setShortSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    className="min-w-0 flex-1 border-0 bg-white px-3.5 py-2 text-[13px] outline-none focus:ring-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void copyReviewLink()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Copy Link
                </button>
              </div>
              {displayLink && (
                <a
                  href={reviewUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                >
                  Open page
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </section>

            {(data.keywordSuggestions ?? []).length > 0 && (
              <section className="border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-2">
                  <h3 className={dashboardCardTitle}>Important phrases</h3>
                  <button type="button" className="text-[10px] text-emerald-700 hover:underline">
                    Help
                  </button>
                </div>
                <p className={`mt-0.5 ${dashboardMicro}`}>
                  Suggest themes customers can mention naturally in their reviews.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data.keywordSuggestions.slice(0, 10).map((k) => {
                    const selected = poster.selectedPhrases.includes(k.keyword);
                    return (
                      <button
                        key={k.id ?? `${k.keyword}-${k.keyword_type ?? "kw"}`}
                        type="button"
                        onClick={() => togglePhrase(k.keyword)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          selected
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                        }`}
                      >
                        {k.keyword}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-500 hover:border-zinc-400"
                  >
                    + Add custom
                  </button>
                </div>
              </section>
            )}

            <section className="border-b border-zinc-100 pb-4">
              <h3 className={dashboardCardTitle}>Match colors with your brand</h3>
              <p className={`mt-0.5 ${dashboardMicro}`}>
                Pick colors that reflect your brand identity. These will be used in the poster.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {POSTER_BRAND_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setPoster((p) => ({ ...p, brandColor: color }))}
                    className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
                      poster.brandColor === color ? "border-zinc-900 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Brand color ${color}`}
                  >
                    {poster.brandColor === color && (
                      <Check className="h-4 w-4 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-zinc-500">Title</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={poster.title}
                    onChange={(e) => setPoster((p) => ({ ...p, title: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-[13px] outline-none focus:border-emerald-500"
                  />
                  <p className="mt-1 text-right text-[10px] text-zinc-400">
                    {poster.title.length} / 50
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-500">Description</label>
                  <input
                    type="text"
                    maxLength={60}
                    value={poster.description}
                    onChange={(e) => setPoster((p) => ({ ...p, description: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3.5 py-2 text-[13px] outline-none focus:border-emerald-500"
                  />
                  <p className="mt-1 text-right text-[10px] text-zinc-400">
                    {poster.description.length} / 60
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
                <div>
                  <label className="flex cursor-pointer items-center gap-3">
                    <span
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition ${
                        poster.showFooter ? "bg-emerald-600" : "bg-zinc-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={poster.showFooter}
                        onChange={(e) => setPoster((p) => ({ ...p, showFooter: e.target.checked }))}
                      />
                      <span
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                          poster.showFooter ? "left-4" : "left-0.5"
                        }`}
                      />
                    </span>
                    <span className="text-[13px] font-medium text-zinc-900">Show footer</span>
                  </label>
                  <p className="mt-0.5 pl-12 text-[10px] text-zinc-500">
                    Adds your business name below the QR code.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-zinc-500">Choose the perfect format</p>
                    <button type="button" className="text-[10px] text-emerald-700 hover:underline">
                      Help
                    </button>
                  </div>
                  <div className="mt-2 flex gap-3">
                    {(["a4", "a5", "letter"] as const).map((f) => (
                      <label key={f} className="flex items-center gap-1.5 text-xs capitalize text-zinc-600">
                        <input
                          type="radio"
                          name="format"
                          checked={poster.format === f}
                          onChange={() => setPoster((p) => ({ ...p, format: f }))}
                        />
                        {f === "letter" ? "Letter" : f.toUpperCase()}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-wrap items-center gap-2.5 border-t border-zinc-100 pt-4">
              <button
                type="button"
                onClick={() => void savePosterSettings()}
                disabled={saving}
                className={rrPrimaryBtn + " px-5 py-2.5"}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => void downloadPoster()}
                className={rrOutlineBtn + " py-2.5"}
              >
                <Download className="h-4 w-4" />
                Download Poster
              </button>
            </section>
            </div>

            <div className="bg-gradient-to-b from-zinc-50 to-zinc-100/90 p-3 lg:sticky lg:top-4 lg:self-start">
              <ReviewPosterPreview
                ref={posterRef}
                businessName={data.businessName}
                poster={poster}
                qrDataUrl={qrDataUrl}
              />
              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-zinc-500">
                <Info className="h-3.5 w-3.5 shrink-0" />
                This is a preview. Final poster may vary slightly in print.
              </p>
            </div>
          </div>
        </div>
      )}

      {section === "messages" && (
        <MessagesSection
          data={data}
          reviewUrl={reviewUrl}
          templateChannel={templateChannel}
          setTemplateChannel={setTemplateChannel}
          copied={copied}
          manualForm={manualForm}
          onCopy={async (text, ch) => {
            await navigator.clipboard.writeText(text);
            setCopied(ch);
            setTimeout(() => setCopied(null), 2000);
            await logEvent({ eventType: "template_copied", channel: ch });
          }}
          onGenerate={async () => {
            setGenerating(true);
            try {
              const res = await fetch("/api/reputation/templates/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ businessId }),
              });
              const json = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(json.error ?? "Generation failed");
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to generate templates");
            } finally {
              setGenerating(false);
            }
          }}
          generating={generating}
        />
      )}

      {section === "triggers" && (
        <ReviewRequestsHandoffCard
          title="Review Triggers"
          description="Create automations that enroll contacts after jobs, imports, or integration events."
          href={`/businesses/${businessId}/integrations`}
          actionLabel="Open Review Triggers"
        />
      )}

      {section === "settings" && (
        <ReviewRequestsHandoffCard
          title="Review Settings"
          description="Manage reputation defaults, alerts, attribution behavior, and request safeguards."
          href={`/businesses/${businessId}/review-settings`}
          actionLabel="Open Review Settings"
        />
      )}

      {section === "bulk" && (
        <ReviewRequestsBulkWizard
          businessId={businessId}
          templates={data.templates}
          onComplete={async () => {
            await loadStats();
          }}
        />
      )}

      {section === "send" && (
        <ReviewRequestsSendSection
          businessId={businessId}
          businessName={data.businessName}
          reviewUrl={reviewUrl}
          templates={data.templates}
          stats={stats}
          onSent={async () => {
            await load();
            await loadStats();
          }}
        />
      )}

      {section === "tracking" && (
        <TrackingSection
          businessId={businessId}
          stats={stats}
          events={data.events}
          sends={stats?.recent_sends ?? []}
          replies={stats?.recent_replies ?? []}
          previewCampaigns={previewData?.campaigns}
          manualForm={manualForm}
          setManualForm={setManualForm}
          submitting={submittingManual}
          onSubmit={async () => {
            setSubmittingManual(true);
            try {
              const res = await fetch("/api/reputation/review-requests/log-manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  businessId,
                  customerName: manualForm.customerName || undefined,
                  customerPhone: manualForm.customerPhone || undefined,
                  customerEmail: manualForm.customerEmail || undefined,
                  serviceType: manualForm.serviceType || undefined,
                  channel: manualForm.channel,
                  notes: manualForm.notes || undefined,
                }),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error ?? "Log failed");
              setManualForm({
                customerName: "",
                customerPhone: "",
                customerEmail: "",
                serviceType: "",
                channel: "sms",
                notes: "",
              });
              await load();
              await loadStats();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Log failed");
            } finally {
              setSubmittingManual(false);
            }
          }}
        />
      )}
    </div>
  );
}

function MessagesSection({
  data,
  reviewUrl,
  templateChannel,
  setTemplateChannel,
  copied,
  onCopy,
  onGenerate,
  generating,
}: {
  data: KitData;
  reviewUrl: string | null;
  templateChannel: TemplateChannel;
  setTemplateChannel: (c: TemplateChannel) => void;
  copied: string | null;
  onCopy: (text: string, ch: string) => Promise<void>;
  onGenerate: () => Promise<void>;
  generating: boolean;
  manualForm?: { customerName: string; serviceType: string };
}) {
  const [tone, setTone] = useState("Friendly");
  const reviewLinkLabel = "leave a review here";
  const varsCopy = {
    customer_name: "Sarah",
    business_name: data.businessName,
    review_link: reviewUrl ?? "{{review_link}}",
    service_type: "recent project",
  };
  const varsPreview = { ...varsCopy, review_link: reviewLinkLabel };

  const templates = data.templates.filter((t) => t.channel === templateChannel);
  const active = templates.find((t) => t.is_default) ?? templates[0];
  const previewBody = active ? renderTemplate(active.body, varsPreview) : "";
  const copyBody = active ? renderTemplate(active.body, varsCopy) : "";

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className={cn(dashboardCard, "space-y-3 p-3")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50/50 p-0.5">
            {(
              [
                { id: "sms" as const, label: "SMS", icon: MessageSquare },
                { id: "email" as const, label: "Email", icon: Mail },
                { id: "generic" as const, label: "Generic", icon: Copy },
              ] as const
            ).map(({ id, label, icon: ChIcon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTemplateChannel(id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium ${
                  templateChannel === id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-white"
                }`}
              >
                <ChIcon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void onGenerate()}
            disabled={generating}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-emerald-600 px-3.5 py-2 text-[13px] font-medium text-emerald-700 hover:bg-emerald-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI Templates
          </button>
        </div>

        {active ? (
          <>
            <div>
              <label className={rrLabelClass}>Template Name</label>
              <p className="mt-0.5 text-[11px] text-zinc-400">Internal name to identify this template.</p>
              <input
                readOnly
                value={active.name}
                className={rrInputClass + " bg-zinc-50"}
              />
              <p className="mt-1 text-right text-[10px] text-zinc-400">
                {active.name.length} / 80
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500">Message Content</label>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Craft a short, friendly message that encourages customers to leave a review.
              </p>
              <div className="relative mt-2">
                <textarea
                  readOnly
                  rows={6}
                  value={active.body}
                  className="w-full rounded-lg border border-zinc-200 px-3.5 py-2 pr-10 text-[13px] leading-relaxed outline-none"
                />
                <button
                  type="button"
                  className="absolute bottom-2.5 right-2.5 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                  aria-label="Emoji picker"
                >
                  <Smile className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-right text-[10px] text-zinc-400">
                {active.body.length} / 320
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["{{customer_name}}", "{{business_name}}", "{{review_link}}", "{{service_type}}"].map(
                  (token) => (
                    <span
                      key={token}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600"
                    >
                      {token}
                    </span>
                  )
                )}
                <button type="button" className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] text-zinc-500">
                  More tokens ▾
                </button>
              </div>
            </div>

            <div>
              <p className={rrLabelClass}>Tone &amp; Language</p>
              <p className="mt-0.5 text-[11px] text-zinc-400">Choose the tone of your message.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["Friendly", "Professional", "Grateful", "Casual", "Enthusiastic"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                      tone === t
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                    }`}
                  >
                    {tone === t && "✓ "}
                    {t}
                  </button>
                ))}
              </div>
              <select className="mt-2 rounded-lg border border-zinc-200 px-3.5 py-2 text-xs text-zinc-700">
                <option>English (US)</option>
              </select>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
              <p className={dashboardCardTitle}>Template Settings</p>
              <div className="mt-2.5 space-y-3">
                <label className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-zinc-700">Include review link</span>
                    <p className="mt-0.5 text-[11px] text-zinc-400">Automatically append the review link to messages.</p>
                  </div>
                  <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full bg-emerald-600">
                    <span className="absolute left-4 top-0.5 h-4 w-4 rounded-full bg-white shadow" />
                  </span>
                </label>
                <label className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-zinc-700">Shorten link</span>
                    <p className="mt-0.5 text-[11px] text-zinc-400">Use a shortened version of the review link.</p>
                  </div>
                  <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full bg-emerald-600">
                    <span className="absolute left-4 top-0.5 h-4 w-4 rounded-full bg-white shadow" />
                  </span>
                </label>
                <div>
                  <p className="text-xs font-medium text-zinc-700">Delay (optional)</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">Wait before sending after a job is marked complete.</p>
                  <select className="mt-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700">
                    <option>1 hour</option>
                    <option>24 hours</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void onCopy(copyBody, templateChannel)}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#137752] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#0f6344]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied === templateChannel ? "Copied" : "Copy Template"}
              </button>
              <button
                type="button"
                onClick={() => void onGenerate()}
                disabled={generating}
                className="rounded-lg border border-zinc-200 px-3.5 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
              >
                {generating ? "Generating…" : "Regenerate with AI"}
              </button>
            </div>
          </>
        ) : (
          <p className={dashboardBody}>No templates yet. Generate AI templates to get started.</p>
        )}
      </div>

      <div className={cn(dashboardCard, "p-3")}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={dashboardCardTitle}>Live Preview</h3>
            <p className={`mt-0.5 ${dashboardMicro}`}>
              This is how your message will appear to customers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onCopy(copyBody, templateChannel)}
            className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Copy {templateChannel.toUpperCase()}
          </button>
        </div>
        <div className="mx-auto mt-3 max-w-[260px] rounded-[2rem] border-[3px] border-zinc-800 bg-zinc-800 p-1.5 shadow-xl">
          <div className="overflow-hidden rounded-[1.65rem] bg-zinc-100">
            <div className="flex items-center justify-between bg-white px-4 py-1.5 text-[10px] font-semibold text-zinc-900">
              <span>9:41</span>
              <div className="flex items-center gap-1 text-zinc-400">
                <span className="text-[8px]">●●●</span>
              </div>
            </div>
            <div className="min-h-[200px] px-3 py-4">
              <div className="flex justify-start">
                <div className="max-w-[92%] rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 shadow-sm ring-1 ring-zinc-200/80">
                  <MessageWithLink
                    text={previewBody}
                    linkLabel={reviewLinkLabel}
                    linkUrl={reviewUrl}
                    className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800"
                    linkClassName="font-medium text-blue-600 underline underline-offset-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-zinc-500">
          ✨ Preview uses sample data. Tokens will be replaced when sent.
        </p>

        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Shield className="h-4 w-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs font-semibold text-zinc-900">Compliance Reminder</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Keep your messages compliant with SMS regulations.</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[11px] text-zinc-600">
                <li>Obtain consent before sending SMS messages.</li>
                <li>Include business name in every message.</li>
                <li>Provide an easy opt-out: &quot;Reply STOP to opt-out.&quot;</li>
              </ul>
              <button type="button" className="mt-2 text-[11px] font-medium text-emerald-700 hover:underline">
                Learn more about SMS compliance ↗
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackingSection({
  businessId,
  stats,
  events,
  sends,
  replies,
  previewCampaigns,
  manualForm,
  setManualForm,
  submitting,
  onSubmit,
}: {
  businessId: string;
  stats: {
    total_sent: number;
    email_sent: number;
    sms_sent: number;
    failed: number;
    replies?: number;
    last_30_days: number;
  } | null;
  events: EventRow[];
  sends: Array<{
    id: string;
    channel: string;
    status: string;
    recipient_email?: string | null;
    recipient_phone?: string | null;
    message_body?: string;
    sent_at?: string | null;
    created_at: string;
    has_reply?: boolean;
    review_request_contacts?: { customer_name?: string | null } | null;
  }>;
  replies: ReviewReplyRow[];
  previewCampaigns?: CampaignRow[];
  manualForm: {
    customerName: string;
    customerPhone: string;
    customerEmail: string;
    serviceType: string;
    channel: string;
    notes: string;
  };
  setManualForm: React.Dispatch<React.SetStateAction<typeof manualForm>>;
  submitting: boolean;
  onSubmit: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const total = stats?.total_sent ?? 0;
  const failed = stats?.failed ?? 0;
  const deliveryRate =
    total + failed > 0 ? `${((total / (total + failed)) * 100).toFixed(1)}%` : "—";

  const filteredSends = sends.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = s.review_request_contacts?.customer_name?.toLowerCase() ?? "";
    const recipient = (s.recipient_email ?? s.recipient_phone ?? "").toLowerCase();
    return name.includes(q) || recipient.includes(q);
  });

  return (
    <div className="space-y-4">
      <ReviewRequestsCampaignsTable
        businessId={businessId}
        campaigns={previewCampaigns}
        loading={previewCampaigns ? false : undefined}
      />

      {stats && (
        <KpiRow cols={6}>
          <ReviewRequestsKpiCard
            label="Requests Sent"
            value={stats.last_30_days}
            icon={Send}
            iconClass="bg-emerald-50 text-emerald-600"
          />
          <ReviewRequestsKpiCard
            label="Delivery Rate"
            value={deliveryRate}
            icon={Check}
            iconClass="bg-emerald-50 text-emerald-600"
          />
          <ReviewRequestsKpiCard
            label="Sent by Email"
            value={stats.email_sent}
            sub={pctOfTotal(stats.email_sent, total)}
            icon={Mail}
            iconClass="bg-violet-50 text-violet-600"
          />
          <ReviewRequestsKpiCard
            label="Sent by SMS"
            value={stats.sms_sent}
            sub={pctOfTotal(stats.sms_sent, total)}
            icon={MessageSquare}
            iconClass="bg-sky-50 text-sky-600"
          />
          <ReviewRequestsKpiCard
            label="Failed"
            value={failed}
            sub={pctOfTotal(failed, total + failed)}
            icon={X}
            iconClass="bg-red-50 text-red-600"
          />
          <ReviewRequestsKpiCard
            label="Replies"
            value={stats.replies ?? 0}
            sub={responseRate(stats.replies ?? 0, total)}
            icon={ArrowLeftRight}
            iconClass="bg-emerald-50 text-emerald-600"
          />
        </KpiRow>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className={cn(dashboardCard, "p-3")}>
            <h3 className={dashboardCardTitle}>Log a manual send</h3>
            <p className={`mt-0.5 ${dashboardMicro}`}>
              Record review requests sent outside the platform (in person, phone, etc.).
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={rrLabelClass}>Customer name</label>
                <input
                  placeholder="e.g. Jane Smith"
                  value={manualForm.customerName}
                  onChange={(e) => setManualForm((f) => ({ ...f, customerName: e.target.value }))}
                  className={rrInputClass}
                />
              </div>
              <div>
                <label className={rrLabelClass}>Service type</label>
                <select
                  value={manualForm.serviceType}
                  onChange={(e) => setManualForm((f) => ({ ...f, serviceType: e.target.value }))}
                  className={rrInputClass}
                >
                  <option value="">Select service</option>
                  <option value="Junk Removal">Junk Removal</option>
                  <option value="Hauling">Hauling</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={rrLabelClass}>Channel</label>
                <select
                  value={manualForm.channel}
                  onChange={(e) => setManualForm((f) => ({ ...f, channel: e.target.value }))}
                  className={rrInputClass}
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                  <option value="print">Print</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={rrLabelClass}>Notes (optional)</label>
                <textarea
                  rows={3}
                  placeholder="Internal notes about this send…"
                  value={manualForm.notes}
                  onChange={(e) => setManualForm((f) => ({ ...f, notes: e.target.value }))}
                  className={rrInputClass}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={submitting}
              className={rrPrimaryBtn + " mt-4"}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Mark as sent
            </button>
          </div>

          <div className={cn(dashboardCard, "overflow-hidden")}>
            <div className="border-b border-zinc-100 px-3.5 py-2.5">
              <h3 className={dashboardCardTitle}>Recent Requests</h3>
              <p className={`mt-0.5 ${dashboardMicro}`}>Track every review request sent from this business.</p>
            </div>
            <div className="border-b border-zinc-100 px-3.5 py-2.5">
              <div className="relative min-w-[200px] max-w-md">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  placeholder="Search by customer, phone, email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 py-2 pl-8 pr-3 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-3.5 py-2">Status</th>
                    <th className="px-3.5 py-2">Recipient</th>
                    <th className="px-3.5 py-2">Channel</th>
                    <th className="px-3.5 py-2">Message Preview</th>
                    <th className="px-3.5 py-2">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredSends.length === 0 && events.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-zinc-500">
                        No activity yet.
                      </td>
                    </tr>
                  ) : (
                    filteredSends.slice(0, 10).map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-50">
                        <td className="px-3.5 py-2">
                          {statusPill(s.status, s.has_reply)}
                        </td>
                        <td className="px-3.5 py-2">
                          <p className="font-medium text-zinc-900">
                            {s.review_request_contacts?.customer_name ?? "—"}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {s.recipient_email ?? s.recipient_phone ?? "—"}
                          </p>
                        </td>
                        <td className="px-3.5 py-2">
                          <span className="inline-flex items-center gap-1 capitalize text-zinc-700">
                            {s.channel === "email" ? (
                              <Mail className="h-3.5 w-3.5 text-violet-500" />
                            ) : (
                              <MessageSquare className="h-3.5 w-3.5 text-sky-500" />
                            )}
                            {s.channel}
                          </span>
                        </td>
                        <td className="max-w-[180px] truncate px-3.5 py-2 text-zinc-500">
                          {s.message_body?.slice(0, 50) ?? "—"}
                        </td>
                        <td className="px-3.5 py-2 text-zinc-500">
                          {new Date(s.sent_at ?? s.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {filteredSends.length > 0 && (
              <div className="border-t border-zinc-100 px-3.5 py-2.5 text-[11px] text-zinc-500">
                Showing {Math.min(10, filteredSends.length)} of {filteredSends.length} results
              </div>
            )}
          </div>
        </div>

        <div className={cn(dashboardCard, "p-3 xl:sticky xl:top-4 xl:self-start")}>
          <div className="flex items-center gap-2">
            <h3 className={dashboardCardTitle}>Customer Replies</h3>
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {replies.length}
            </span>
          </div>
          <p className={`mt-1 ${dashboardMicro}`}>
            View and manage replies from your review requests.
          </p>
          <div className="mt-3">
            <ReviewRequestRepliesPanel
              replies={replies}
              compact
              showTabs
              showViewAll
              businessId={businessId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRequestsHandoffCard({
  title,
  description,
  href,
  actionLabel,
}: {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <div className={cn(dashboardCard, "p-4")}>
      <p className={dashboardCardTitle}>{title}</p>
      <p className={`mt-1 max-w-2xl ${dashboardMicro}`}>{description}</p>
      <a
        href={href}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[13px] font-semibold text-white hover:bg-emerald-800"
      >
        {actionLabel}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
