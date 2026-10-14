"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import {
  BarChart3,
  Check,
  Copy,
  Download,
  ExternalLink,
  Info,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { ReviewPosterPreview } from "@/components/reputation/review-poster-preview";
import {
  QR_MOCK_COLORS,
  QrKpiCard,
  QrStatusBadge,
  qrUi,
} from "@/components/reputation/qr-campaigns/qr-ui";
import { PlacementPicker } from "@/components/reputation/qr-campaigns/placement-picker";
import { PosterTemplatePicker } from "@/components/reputation/qr-campaigns/poster-template-picker";
import {
  DEFAULT_POSTER_CONFIG,
  type PosterConfig,
} from "@/lib/reputation/poster-config";
import {
  CLASSIC_POSTER_TEMPLATE,
  isPremiumPosterTemplate,
  normalizePosterTemplateKey,
  type PosterTemplateKey,
} from "@/lib/reputation/poster-templates";
import { organizationLooksLikeTrial } from "@/lib/auth/trial-status";
import {
  type QrCampaignAnalytics,
  type QrCampaignStatus,
  type QrPlacementType,
  type QrPrintFormat,
  type ReviewQrCampaign,
} from "@/lib/reputation/qr-campaigns/types";
import { PaymentQrCampaignEditor } from "@/components/reputation/payment-qr/payment-qr-campaign-editor";
import { cn } from "@/lib/utils";

type LoadResponse = {
  campaign?: ReviewQrCampaign;
  campaigns?: ReviewQrCampaign[];
  trackedUrl?: string;
  error?: string;
  limitKey?: string;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function posterFormatFromPrint(format: QrPrintFormat): PosterConfig["format"] {
  if (format === "a5" || format === "letter") return format;
  return "a4";
}

export function QrCampaignEditor({
  businessId,
  campaignId,
}: {
  businessId: string;
  campaignId?: string;
}) {
  const router = useRouter();
  const plansHref = `/businesses/${businessId}/reputation/qr-campaigns/plans`;
  const posterRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planLimit, setPlanLimit] = useState(false);
  const [copied, setCopied] = useState(false);
  const [businessName, setBusinessName] = useState("Your business");
  const [campaign, setCampaign] = useState<ReviewQrCampaign | null>(null);
  const [trackedUrl, setTrackedUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [placementType, setPlacementType] = useState<QrPlacementType>("standard_poster");
  const [customPlacementLabel, setCustomPlacementLabel] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [headline, setHeadline] = useState(DEFAULT_POSTER_CONFIG.title);
  const [description, setDescription] = useState(DEFAULT_POSTER_CONFIG.description);
  const [brandColor, setBrandColor] = useState(DEFAULT_POSTER_CONFIG.brandColor);
  const [showFooter, setShowFooter] = useState(true);
  const [printFormat, setPrintFormat] = useState<QrPrintFormat>("a4");
  const [templateKey, setTemplateKey] = useState<PosterTemplateKey>(CLASSIC_POSTER_TEMPLATE);
  const [canUsePremiumTemplates, setCanUsePremiumTemplates] = useState(false);
  const [status, setStatus] = useState<QrCampaignStatus>("active");
  const [newReviews30d, setNewReviews30d] = useState<number | null>(null);

  const applyCampaign = useCallback((c: ReviewQrCampaign, url?: string) => {
    setCampaign(c);
    setTrackedUrl(
      url ||
        (typeof window !== "undefined"
          ? `${window.location.origin}/r/${c.shortCode}`
          : `/r/${c.shortCode}`)
    );
    setName(c.name);
    setPlacementType(c.placementType);
    setCustomPlacementLabel(c.customPlacementLabel ?? "");
    setDestinationUrl(c.destinationUrl);
    setHeadline(c.headline || c.posterConfig?.title || DEFAULT_POSTER_CONFIG.title);
    setDescription(c.description || c.posterConfig?.description || DEFAULT_POSTER_CONFIG.description);
    setBrandColor(c.brandColor || c.posterConfig?.brandColor || DEFAULT_POSTER_CONFIG.brandColor);
    setShowFooter(c.showFooter ?? c.posterConfig?.showFooter ?? true);
    setPrintFormat(c.printFormat === "qr_only" ? "a4" : c.printFormat);
    const loadedTemplate = normalizePosterTemplateKey(c.templateKey);
    setTemplateKey(loadedTemplate);
    setStatus(c.status);
  }, []);

  // Clamp premium templates if the account cannot use them (e.g. trial load).
  useEffect(() => {
    if (!canUsePremiumTemplates && isPremiumPosterTemplate(templateKey)) {
      setTemplateKey(CLASSIC_POSTER_TEMPLATE);
    }
  }, [canUsePremiumTemplates, templateKey]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlanLimit(false);
    try {
      const accountRes = await fetch(`/api/businesses/${businessId}/account`);
      if (accountRes.ok) {
        const accountJson = (await accountRes.json()) as { account?: { name?: string } };
        if (accountJson.account?.name) setBusinessName(accountJson.account.name);
      }

      try {
        const usageRes = await fetch("/api/account/usage");
        if (usageRes.ok) {
          const usageJson = (await usageRes.json()) as {
            organization?: { plan?: string; billing_status?: string | null };
          };
          const org = usageJson.organization;
          setCanUsePremiumTemplates(
            !organizationLooksLikeTrial({
              plan: org?.plan,
              billing_status: org?.billing_status,
            })
          );
        } else {
          setCanUsePremiumTemplates(false);
        }
      } catch {
        setCanUsePremiumTemplates(false);
      }

      const url = campaignId
        ? `/api/reputation/qr-campaigns/${campaignId}?businessId=${encodeURIComponent(businessId)}`
        : `/api/reputation/qr-campaigns?businessId=${encodeURIComponent(businessId)}&ensureDefault=1`;
      const res = await fetch(url);
      const json = (await res.json()) as LoadResponse;
      if (!res.ok) {
        if (res.status === 402 || json.limitKey) setPlanLimit(true);
        throw new Error(json.error ?? "Failed to load QR campaign");
      }

      const c = json.campaign ?? json.campaigns?.[0] ?? null;
      if (!c) throw new Error("No QR campaign found. Create one to get started.");
      applyCampaign(c, json.trackedUrl);
      if (!campaignId && c.id) {
        router.replace(`/businesses/${businessId}/reputation/qr-campaigns/${c.id}`);
      }
      try {
        const aRes = await fetch(
          `/api/reputation/qr-campaigns/${c.id}/analytics?businessId=${encodeURIComponent(businessId)}&days=30`
        );
        if (aRes.ok) {
          const aJson = (await aRes.json()) as QrCampaignAnalytics;
          setNewReviews30d(aJson.newReviewsInPeriod ?? null);
        }
      } catch {
        setNewReviews30d(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  }, [applyCampaign, businessId, campaignId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!trackedUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(trackedUrl, {
      width: 400,
      margin: 1,
      color: { dark: "#0B1B32", light: "#ffffff" },
    }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [trackedUrl]);

  const poster: PosterConfig = {
    title: headline,
    description,
    brandColor,
    showFooter,
    format: posterFormatFromPrint(printFormat),
    selectedPhrases: campaign?.posterConfig?.selectedPhrases ?? [],
  };

  async function save() {
    if (!campaign) return;
    setSaving(true);
    setError(null);
    setPlanLimit(false);
    try {
      const res = await fetch(`/api/reputation/qr-campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          patch: {
            name: name.trim() || "QR Campaign",
            placementType,
            customPlacementLabel:
              placementType === "custom" ? customPlacementLabel.trim() || null : null,
            destinationUrl: destinationUrl.trim(),
            headline,
            description,
            brandColor,
            printFormat,
            showFooter,
            templateKey,
            status,
            posterConfig: poster,
          },
        }),
      });
      const json = (await res.json()) as LoadResponse;
      if (!res.ok) {
        if (res.status === 402 || json.limitKey) setPlanLimit(true);
        throw new Error(json.error ?? "Save failed");
      }
      if (json.campaign) applyCampaign(json.campaign, json.trackedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const next: QrCampaignStatus = status === "active" ? "paused" : "active";
    setStatus(next);
    if (!campaign) return;
    setSaving(true);
    setError(null);
    setPlanLimit(false);
    try {
      const res = await fetch(`/api/reputation/qr-campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, patch: { status: next } }),
      });
      const json = (await res.json()) as LoadResponse;
      if (!res.ok) {
        setStatus(status);
        if (res.status === 402 || json.limitKey) setPlanLimit(true);
        throw new Error(json.error ?? "Could not update status");
      }
      if (json.campaign) applyCampaign(json.campaign, json.trackedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update status");
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    if (!campaign) return;
    setSaving(true);
    setError(null);
    setPlanLimit(false);
    try {
      const res = await fetch(`/api/reputation/qr-campaigns/${campaign.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, action: "duplicate" }),
      });
      const json = (await res.json()) as LoadResponse;
      if (!res.ok) {
        if (res.status === 402 || json.limitKey) setPlanLimit(true);
        throw new Error(json.error ?? "Duplicate failed");
      }
      if (json.campaign?.id) {
        router.push(`/businesses/${businessId}/reputation/qr-campaigns/${json.campaign.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Duplicate failed");
    } finally {
      setSaving(false);
    }
  }

  async function copyTrackedLink() {
    if (!trackedUrl) return;
    await navigator.clipboard.writeText(trackedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function downloadPoster() {
    if (!posterRef.current) return;
    const dataUrl = await toPng(posterRef.current, { pixelRatio: 2, cacheBust: true });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${campaign?.shortCode || "qr"}-poster.png`;
    a.click();
  }

  function downloadQrOnly() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${campaign?.shortCode || "qr"}-code.png`;
    a.click();
  }

  if (loading) {
    return (
      <ModulePage className="space-y-6">
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#667085]">
          <Loader2 className="h-5 w-5 animate-spin text-[#16A34A]" />
          Loading QR campaign…
        </div>
      </ModulePage>
    );
  }

  if (campaign?.campaignType === "payment_review" && campaignId) {
    return <PaymentQrCampaignEditor businessId={businessId} campaignId={campaignId} />;
  }

  if (!campaign) {
    return (
      <ModulePage className="space-y-6">
        <div className={cn(qrUi.cardPad, "border-dashed text-center")}>
          <h2 className="text-lg font-bold text-[#0B1B32]">QR campaign unavailable</h2>
          <p className="mt-2 text-sm text-[#667085]">{error ?? "Could not load this campaign."}</p>
          {planLimit ? (
            <p className="mt-3 text-sm text-[#B54708]">
              Your plan limit was reached. Pause another campaign or{" "}
              <Link href={plansHref} className="font-semibold text-[#16A34A] underline">
                upgrade
              </Link>
              .
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => void load()} className={qrUi.btnSecondary}>
              Retry
            </button>
            <Link
              href={`/businesses/${businessId}/reputation/qr-campaigns/new`}
              className={qrUi.btnPrimary}
            >
              Create campaign
            </Link>
          </div>
        </div>
      </ModulePage>
    );
  }

  return (
    <ModulePage className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className={qrUi.title}>{name || "QR Campaign"}</h1>
          <p className={qrUi.subtitle}>
            Track scans from printed posters, then send visitors to your Google review page.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns`}
            className={qrUi.btnSecondary}
          >
            All campaigns
          </Link>
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns/${campaign.id}/analytics`}
            className={qrUi.btnSecondary}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </Link>
        </div>
      </div>

      {campaign.migratedFromLinkId ? (
        <div className="rounded-2xl border border-[#FEDF89] bg-[#FFFAEB] px-5 py-4 text-sm text-[#B54708]">
          <p className="font-semibold">Migrated campaign</p>
          <p className="mt-1">
            This campaign was migrated from an older review link. Previously printed QR codes that
            pointed directly at Google cannot be retroactively tracked — reprint using this tracked
            link going forward.
          </p>
        </div>
      ) : null}

      {error ? (
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-sm",
            planLimit
              ? "border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {error}
          {planLimit ? (
            <span className="mt-1 block">
              <Link href={plansHref} className="font-semibold underline">
                View plans
              </Link>{" "}
              to create or activate more QR campaigns.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QrKpiCard label="Total scans" value={campaign.totalScans.toLocaleString()} />
        <QrKpiCard
          label="Est. unique scans"
          value={campaign.estimatedUniqueScans.toLocaleString()}
          hint="Approximate unique visitors (24h window)"
        />
        <QrKpiCard
          label="New reviews (30d)"
          value={newReviews30d == null ? "—" : newReviews30d.toLocaleString()}
          hint="Correlated in the same window — not proven from QR"
        />
        <QrKpiCard label="Last scanned" value={formatDate(campaign.lastScannedAt)} />
      </div>

      <div className={cn(qrUi.card, "overflow-hidden")}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* Form */}
          <div className="space-y-5 border-b border-[#E6EAF0] p-5 lg:border-b-0 lg:border-r lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <QrStatusBadge status={status} />
                <span className="text-xs text-[#667085]">/{campaign.shortCode}</span>
              </div>
              <button
                type="button"
                onClick={() => void toggleActive()}
                disabled={saving}
                className={qrUi.btnSecondary}
              >
                {status === "active" ? (
                  <>
                    <Pause className="h-4 w-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" /> Activate
                  </>
                )}
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#A6F4C5] bg-[linear-gradient(135deg,#ECFDF3_0%,#ffffff_60%)] p-4">
              <div className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#027A48]" />
                <p className="text-sm text-[#027A48]">
                  Your tracked link records each visit, then redirects to Google Reviews. Print the
                  QR that encodes this tracked URL — never a direct Google URL — so scans stay
                  measurable.
                </p>
              </div>
            </div>

            <div>
              <label className={qrUi.label}>Tracked link</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input readOnly value={trackedUrl} className={cn(qrUi.input, "min-w-0 flex-1")} />
                <button type="button" onClick={() => void copyTrackedLink()} className={qrUi.btnSecondary}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <label className={qrUi.label}>Campaign name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(qrUi.input, "mt-1.5")}
                maxLength={80}
              />
            </div>

            <div>
              <label className={cn(qrUi.label, "mb-2.5 block")}>Placement</label>
              <PlacementPicker value={placementType} onChange={setPlacementType} />
            </div>

            {placementType === "custom" ? (
              <div>
                <label className={qrUi.label}>Custom placement label</label>
                <input
                  value={customPlacementLabel}
                  onChange={(e) => setCustomPlacementLabel(e.target.value)}
                  className={cn(qrUi.input, "mt-1.5")}
                  placeholder="e.g. Waiting room wall"
                />
              </div>
            ) : null}

            <div>
              <label className={qrUi.label}>Destination URL</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <input
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  className={cn(qrUi.input, "min-w-0 flex-1")}
                  placeholder="https://search.google.com/local/writereview?placeid=…"
                />
                <a
                  href={destinationUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(qrUi.btnSecondary, !destinationUrl && "pointer-events-none opacity-50")}
                >
                  <ExternalLink className="h-4 w-4" />
                  Test link
                </a>
              </div>
              <p className="mt-1.5 text-xs text-[#667085]">
                Where visitors land after the tracked redirect — not encoded in the QR.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={qrUi.label}>Headline</label>
                <input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  className={cn(qrUi.input, "mt-1.5")}
                  maxLength={50}
                />
              </div>
              <div>
                <label className={qrUi.label}>Description</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={cn(qrUi.input, "mt-1.5")}
                  maxLength={60}
                />
              </div>
            </div>

            <div>
              <label className={qrUi.label}>Brand color</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {QR_MOCK_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setBrandColor(color)}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition",
                      brandColor === color ? "scale-110 border-[#0B1B32]" : "border-transparent"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`Brand color ${color}`}
                  >
                    {brandColor === color ? (
                      <Check className="h-4 w-4 text-white drop-shadow" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <PosterTemplatePicker
              value={templateKey}
              canUsePremium={canUsePremiumTemplates}
              upgradeHref={plansHref}
              onChange={(key, meta) => {
                setTemplateKey(key);
                // Apply template copy when switching away from classic defaults or onto a new layout
                setHeadline(meta.suggestedTitle);
                setDescription(meta.suggestedDescription);
              }}
            />

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#E6EAF0] pt-4">
              {templateKey === CLASSIC_POSTER_TEMPLATE ? (
                <label className="flex cursor-pointer items-center gap-3">
                  <span
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 rounded-full transition",
                      showFooter ? "bg-[#16A34A]" : "bg-[#D0D5DD]"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={showFooter}
                      onChange={(e) => setShowFooter(e.target.checked)}
                    />
                    <span
                      className={cn(
                        "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                        showFooter ? "left-5" : "left-0.5"
                      )}
                    />
                  </span>
                  <span className="text-sm font-medium text-[#0B1B32]">Show footer</span>
                </label>
              ) : (
                <p className="text-sm text-[#667085]">Print size</p>
              )}
              <div className="flex gap-3">
                {(["a4", "a5", "letter"] as const).map((f) => (
                  <label
                    key={f}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      printFormat === f
                        ? "border-[#16A34A] bg-[#ECFDF3] text-[#027A48]"
                        : "border-[#E6EAF0] text-[#667085]"
                    )}
                  >
                    <input
                      type="radio"
                      name="format"
                      className="sr-only"
                      checked={printFormat === f}
                      onChange={() => setPrintFormat(f)}
                    />
                    {f === "letter" ? "Letter" : f.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[#E6EAF0] pt-5">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className={qrUi.btnPrimary}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
              </button>
              <button type="button" onClick={() => void downloadPoster()} className={qrUi.btnSecondary}>
                <Download className="h-4 w-4" />
                Download Poster
              </button>
              <button
                type="button"
                onClick={downloadQrOnly}
                disabled={!qrDataUrl}
                className={qrUi.btnSecondary}
              >
                <Download className="h-4 w-4" />
                QR Only
              </button>
              <Link
                href={`/businesses/${businessId}/reputation/qr-campaigns/${campaign.id}/analytics`}
                className={qrUi.btnSecondary}
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
              <button
                type="button"
                onClick={() => void duplicate()}
                disabled={saving}
                className={qrUi.btnSecondary}
              >
                <Copy className="h-4 w-4" />
                Duplicate
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-gradient-to-b from-[#F4F7FB] to-white p-5 lg:sticky lg:top-4 lg:self-start lg:p-6">
            <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-[#98A2B3]">
              Poster preview
            </p>
            <ReviewPosterPreview
              ref={posterRef}
              businessName={businessName}
              poster={poster}
              qrDataUrl={qrDataUrl}
              templateKey={templateKey}
            />
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-[#667085]">
              <Info className="h-3.5 w-3.5 shrink-0" />
              Preview uses your tracked link QR. Final print may vary slightly.
            </p>
          </div>
        </div>
      </div>
    </ModulePage>
  );
}
