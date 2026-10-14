"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Loader2,
  Link2,
} from "lucide-react";
import { ModulePage } from "@/components/ui/design-system";
import { ReviewPosterPreview } from "@/components/reputation/review-poster-preview";
import { PlacementPicker } from "@/components/reputation/qr-campaigns/placement-picker";
import { PosterTemplatePicker } from "@/components/reputation/qr-campaigns/poster-template-picker";
import {
  QR_MOCK_COLORS,
  qrUi,
} from "@/components/reputation/qr-campaigns/qr-ui";
import {
  DEFAULT_POSTER_CONFIG,
  type PosterConfig,
} from "@/lib/reputation/poster-config";
import {
  CLASSIC_POSTER_TEMPLATE,
  type PosterTemplateKey,
} from "@/lib/reputation/poster-templates";
import { organizationLooksLikeTrial } from "@/lib/auth/trial-status";
import {
  QR_PLACEMENT_LABELS,
  type QrPlacementType,
  type ReviewQrCampaign,
} from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Business" },
  { id: 2, label: "Review link" },
  { id: 3, label: "Name & placement" },
  { id: 4, label: "Design" },
  { id: 5, label: "Preview & save" },
] as const;

export function QrCampaignCreateForm({ businessId }: { businessId: string }) {
  const router = useRouter();
  const plansHref = `/businesses/${businessId}/reputation/qr-campaigns/plans`;
  const previewRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planLimit, setPlanLimit] = useState(false);
  const [businessName, setBusinessName] = useState("Your business");
  const [businessCity, setBusinessCity] = useState<string | null>(null);
  const [defaultDestination, setDefaultDestination] = useState("");
  const [loadingBiz, setLoadingBiz] = useState(true);

  const [destinationUrl, setDestinationUrl] = useState("");
  const [name, setName] = useState("Front desk poster");
  const [placementType, setPlacementType] = useState<QrPlacementType>("front_desk");
  const [customPlacementLabel, setCustomPlacementLabel] = useState("");
  const [headline, setHeadline] = useState(DEFAULT_POSTER_CONFIG.title);
  const [description, setDescription] = useState(DEFAULT_POSTER_CONFIG.description);
  const [brandColor, setBrandColor] = useState(DEFAULT_POSTER_CONFIG.brandColor);
  const [showFooter, setShowFooter] = useState(true);
  const [format, setFormat] = useState<PosterConfig["format"]>("a4");
  const [templateKey, setTemplateKey] = useState<PosterTemplateKey>(CLASSIC_POSTER_TEMPLATE);
  const [canUsePremiumTemplates, setCanUsePremiumTemplates] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [accountRes, kitRes, usageRes] = await Promise.all([
          fetch(`/api/businesses/${businessId}/account`),
          fetch(`/api/reputation/review-link/${businessId}`).catch(() => null),
          fetch("/api/account/usage").catch(() => null),
        ]);
        if (cancelled) return;
        if (accountRes.ok) {
          const json = (await accountRes.json()) as {
            account?: { name?: string; address_text?: string | null };
          };
          if (json.account?.name) setBusinessName(json.account.name);
          if (json.account?.address_text) {
            const parts = json.account.address_text.split(",").map((p) => p.trim());
            // Prefer "City, ST …" fragment when present
            if (parts.length >= 2) {
              setBusinessCity(parts.slice(-2).join(", "));
            } else if (parts[0]) {
              setBusinessCity(parts[0]);
            }
          }
        }
        if (usageRes?.ok) {
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
        if (kitRes?.ok) {
          const kit = (await kitRes.json()) as {
            businessName?: string;
            placeId?: string | null;
            link?: { review_url?: string };
          };
          if (kit.businessName) setBusinessName(kit.businessName);
          const dest =
            kit.link?.review_url ||
            (kit.placeId
              ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(kit.placeId)}`
              : "");
          if (dest) {
            setDefaultDestination(dest);
            setDestinationUrl(dest);
          }
        }
      } finally {
        if (!cancelled) setLoadingBiz(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const poster: PosterConfig = useMemo(
    () => ({
      title: headline,
      description,
      brandColor,
      showFooter,
      format,
      selectedPhrases: [],
    }),
    [brandColor, description, format, headline, showFooter]
  );

  useEffect(() => {
    void QRCode.toDataURL("https://example.com/r/preview", {
      width: 400,
      margin: 1,
      color: { dark: "#0B1B32", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, []);

  async function create() {
    setSaving(true);
    setError(null);
    setPlanLimit(false);
    try {
      const res = await fetch("/api/reputation/qr-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: name.trim() || "QR Campaign",
          placementType,
          customPlacementLabel:
            placementType === "custom" ? customPlacementLabel.trim() || null : null,
          destinationUrl: destinationUrl.trim(),
          headline,
          description,
          brandColor,
          printFormat: format,
          showFooter,
          templateKey,
          posterConfig: poster,
        }),
      });
      const json = (await res.json()) as {
        campaign?: ReviewQrCampaign;
        error?: string;
        limitKey?: string;
      };
      if (!res.ok) {
        if (res.status === 402 || json.limitKey) setPlanLimit(true);
        throw new Error(json.error ?? "Could not create campaign");
      }
      if (json.campaign?.id) {
        router.push(`/businesses/${businessId}/reputation/qr-campaigns/${json.campaign.id}`);
      } else {
        router.push(`/businesses/${businessId}/reputation/qr-campaigns`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create campaign");
    } finally {
      setSaving(false);
    }
  }

  function canContinue(): boolean {
    if (step === 1) return Boolean(businessName.trim()) && !loadingBiz;
    if (step === 2) return destinationUrl.trim().length > 8;
    if (step === 3) {
      if (!name.trim()) return false;
      if (placementType === "custom" && !customPlacementLabel.trim()) return false;
      return true;
    }
    return true;
  }

  return (
    <ModulePage className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href={`/businesses/${businessId}/reputation/qr-campaigns`}
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#16A34A] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All campaigns
          </Link>
          <h1 className={qrUi.title}>Create QR Campaign</h1>
          <p className={qrUi.subtitle}>
            Start with your business, then design a tracked Google review QR.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => s.id < step && setStep(s.id)}
            className={cn(
              "rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
              step === s.id
                ? "border-[#16A34A] bg-[#ECFDF3] text-[#027A48] shadow-sm"
                : step > s.id
                  ? "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F9FAFB]"
                  : "border-[#E6EAF0] bg-[#F9FAFB] text-[#98A2B3]"
            )}
          >
            <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-[10px]">
              {step > s.id ? <Check className="h-3 w-3" /> : s.id}
            </span>
            {s.label}
          </button>
        ))}
      </div>

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
              or pause an active campaign to free a slot.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={cn(qrUi.cardPad)}>
        {loadingBiz && step <= 2 ? (
          <div className="mb-4 flex items-center gap-2 text-sm text-[#667085]">
            <Loader2 className="h-4 w-4 animate-spin text-[#16A34A]" /> Loading business details…
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">1. Select business</h2>
              <p className="mt-1 text-sm text-[#667085]">
                This campaign will track Google review scans for the business below.
              </p>
            </div>
            <div className="flex items-start gap-4 rounded-2xl border border-[#A6F4C5] bg-[linear-gradient(135deg,#ECFDF3_0%,#ffffff_70%)] p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#16A34A] text-white">
                <Building2 className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#027A48]">
                  Connected location
                </p>
                <p className="mt-1 text-xl font-extrabold text-[#0B1B32]">{businessName}</p>
                {businessCity ? (
                  <p className="mt-1 text-sm text-[#486581]">{businessCity}</p>
                ) : null}
                <p className="mt-3 text-xs text-[#667085]">
                  Need a different location? Switch it in the sidebar business selector first.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">2. Verify Google review link</h2>
              <p className="mt-1 text-sm text-[#667085]">
                After someone scans your tracked QR, they&apos;ll land on this Google review URL. We
                prefilled it from {businessName} when available.
              </p>
            </div>
            {defaultDestination ? (
              <div className="flex items-start gap-2 rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] px-4 py-3 text-sm text-[#027A48]">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
                Auto-filled from your connected Google business profile.
              </div>
            ) : (
              <div className="rounded-xl border border-[#FEDF89] bg-[#FFFAEB] px-4 py-3 text-sm text-[#B54708]">
                No review link on file yet. Paste your Google review URL or Place ID link below.
              </div>
            )}
            <input
              value={destinationUrl}
              onChange={(e) => setDestinationUrl(e.target.value)}
              className={qrUi.input}
              placeholder="https://search.google.com/local/writereview?placeid=…"
            />
            {defaultDestination && destinationUrl !== defaultDestination ? (
              <button
                type="button"
                className="text-sm font-semibold text-[#16A34A] hover:underline"
                onClick={() => setDestinationUrl(defaultDestination)}
              >
                Use business default
              </button>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">3. Name & placement</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Name the campaign and choose where the QR will live — pick a visual placement.
              </p>
            </div>
            <div>
              <label className={qrUi.label}>Campaign name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(qrUi.input, "mt-1.5")}
                placeholder="Front desk poster"
              />
            </div>
            <div>
              <label className={cn(qrUi.label, "mb-2.5 block")}>Where will this QR live?</label>
              <PlacementPicker
                value={placementType}
                onChange={(t) => {
                  setPlacementType(t);
                  if (t !== "custom" && name === "Front desk poster") {
                    setName(QR_PLACEMENT_LABELS[t]);
                  }
                }}
              />
            </div>
            {placementType === "custom" ? (
              <div>
                <label className={qrUi.label}>Custom label</label>
                <input
                  value={customPlacementLabel}
                  onChange={(e) => setCustomPlacementLabel(e.target.value)}
                  className={cn(qrUi.input, "mt-1.5")}
                  placeholder="e.g. Waiting room TV"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#0B1B32]">4. Customize design</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Choose colors and copy for your print-ready poster.
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
                <label className={qrUi.label}>Supporting text</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={cn(qrUi.input, "mt-1.5")}
                  maxLength={60}
                />
              </div>
            </div>
            <div>
              <label className={qrUi.label}>Poster color</label>
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
                    aria-label={`Color ${color}`}
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
                setHeadline(meta.suggestedTitle);
                setDescription(meta.suggestedDescription);
              }}
            />
            <div className="flex flex-wrap items-center justify-between gap-4">
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
              <div className="flex gap-2">
                {(["a4", "a5", "letter"] as const).map((f) => (
                  <label
                    key={f}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                      format === f
                        ? "border-[#16A34A] bg-[#ECFDF3] text-[#027A48]"
                        : "border-[#E6EAF0] text-[#667085]"
                    )}
                  >
                    <input
                      type="radio"
                      name="create-format"
                      className="sr-only"
                      checked={format === f}
                      onChange={() => setFormat(f)}
                    />
                    {f === "letter" ? "Letter" : f.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#0B1B32]">5. Preview & save</h2>
                <p className="mt-1 text-sm text-[#667085]">
                  Review your campaign details before creating.
                </p>
              </div>
              <ul className="space-y-2 rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4 text-sm text-[#475467]">
                <li>
                  <span className="font-semibold text-[#0B1B32]">Business:</span> {businessName}
                </li>
                <li>
                  <span className="font-semibold text-[#0B1B32]">Name:</span> {name}
                </li>
                <li>
                  <span className="font-semibold text-[#0B1B32]">Placement:</span>{" "}
                  {placementType === "custom"
                    ? customPlacementLabel || "Custom"
                    : QR_PLACEMENT_LABELS[placementType]}
                </li>
                <li className="break-all">
                  <span className="font-semibold text-[#0B1B32]">Destination:</span>{" "}
                  {destinationUrl}
                </li>
              </ul>
              <p className="text-xs text-[#667085]">
                After saving, your poster QR will encode the tracked short link — not the Google URL
                — so every scan can be measured.
              </p>
            </div>
            <div className="rounded-2xl bg-gradient-to-b from-[#F4F7FB] to-white p-4" ref={previewRef}>
              <ReviewPosterPreview
                businessName={businessName}
                poster={poster}
                qrDataUrl={qrDataUrl}
                templateKey={templateKey}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-[#E6EAF0] pt-5">
          <button
            type="button"
            className={qrUi.btnSecondary}
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          {step < 5 ? (
            <button
              type="button"
              className={qrUi.btnPrimary}
              disabled={!canContinue()}
              onClick={() => setStep((s) => Math.min(5, s + 1))}
            >
              Continue
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className={qrUi.btnPrimary}
              disabled={saving || !canContinue()}
              onClick={() => void create()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create campaign
            </button>
          )}
        </div>
      </div>
    </ModulePage>
  );
}
