"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { ReviewsOpusPage } from "@/newui-transplant/connected/reviews/reviews-opus-page";
import { BrandThemeHostedPage } from "@/components/reputation/payment-qr/brand-theme-hosted-page";
import { PosterTemplatePicker } from "@/components/reputation/qr-campaigns/poster-template-picker";
import { qrUi } from "@/components/reputation/qr-campaigns/qr-ui";
import {
  AMOUNT_MODE_LABELS,
  AMOUNT_MODES,
  HOSTED_PAYMENT_SECTION_HEADING,
  PAYMENT_PROVIDERS,
  type AmountMode,
  type PaymentPageConfiguration,
  type PaymentProvider,
} from "@/lib/reputation/payment-qr/types";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { getPaymentProvider } from "@/lib/reputation/payment-qr/providers";
import { CLASSIC_POSTER_TEMPLATE, getPosterTemplate, type PosterTemplateKey } from "@/lib/reputation/poster-templates";
import { pageThemeFromPosterTemplate } from "@/lib/reputation/brand-themes";
import { organizationLooksLikeTrial } from "@/lib/auth/trial-status";
import { cn } from "@/lib/utils";

const WIZARD_STEPS = [
  { id: 1, label: "Business details" },
  { id: 2, label: "Payment options" },
  { id: 3, label: "Amount settings" },
  { id: 4, label: "Reviews & links" },
  { id: 5, label: "Preview & publish" },
] as const;

type MethodState = { enabled: boolean; value: string };

const PROVIDER_HINTS: Record<PaymentProvider, string> = {
  stripe: "Stripe Payment Link (https://buy.stripe.com/...)",
  cash_app: "Payment link or $cashtag",
  venmo: "Username",
  paypal: "paypal.me/you",
  zelle: "Email or phone",
};

export function PaymentQrCreateWizard({ businessId }: { businessId: string }) {
  const router = useRouter();
  const base = `/businesses/${businessId}/reputation/qr-campaigns`;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [businessName, setBusinessName] = useState("Your business");
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");
  const [entitlements, setEntitlements] = useState({
    reviewLinks: false,
    customSlug: false,
    suggestedAmounts: false,
    socialLinks: false,
  });

  const [name, setName] = useState("Pay & Review Page");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#137752");
  const [templateKey, setTemplateKey] = useState<PosterTemplateKey>(CLASSIC_POSTER_TEMPLATE);
  const [canUsePremiumTemplates, setCanUsePremiumTemplates] = useState(false);
  const [publicSlug, setPublicSlug] = useState("");
  const [amountMode, setAmountMode] = useState<AmountMode>("none");
  const [paymentNote, setPaymentNote] = useState("");
  const [amounts, setAmounts] = useState([2500, 5000, 10000, 15000]);
  const [facebookReviewUrl, setFacebookReviewUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [facebookPageUrl, setFacebookPageUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [pinterestUrl, setPinterestUrl] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");

  const [methods, setMethods] = useState<Record<PaymentProvider, MethodState>>({
    stripe: { enabled: false, value: "" },
    venmo: { enabled: false, value: "" },
    cash_app: { enabled: false, value: "" },
    paypal: { enabled: false, value: "" },
    zelle: { enabled: false, value: "" },
  });

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const previewSlug = publicSlug.trim() || "preview";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [accountRes, kitRes, entRes, usageRes] = await Promise.all([
          fetch(`/api/businesses/${businessId}/account`),
          fetch(`/api/reputation/review-link/${businessId}`).catch(() => null),
          fetch(`/api/reputation/payment-qr?businessId=${businessId}`),
          fetch(`/api/account/usage?businessId=${businessId}`).catch(() => null),
        ]);
        if (cancelled) return;
        if (accountRes.ok) {
          const json = (await accountRes.json()) as { account?: { name?: string } };
          if (json.account?.name) {
            setBusinessName(json.account.name);
            setName(`${json.account.name} — Pay & Review`);
            setTitle(`Pay ${json.account.name}`);
          }
        }
        if (kitRes?.ok) {
          const kit = (await kitRes.json()) as {
            link?: { review_url?: string };
            placeId?: string;
          };
          const dest =
            kit.link?.review_url ||
            (kit.placeId
              ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(kit.placeId)}`
              : "");
          if (dest) setGoogleReviewUrl(dest);
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
        }
        if (entRes.ok) {
          const json = (await entRes.json()) as {
            entitlements?: {
              reviewLinks?: boolean;
              customSlug?: boolean;
              suggestedAmounts?: boolean;
              socialLinks?: boolean;
            };
          };
          const e = json.entitlements ?? {};
          setEntitlements({
            reviewLinks: Boolean(e.reviewLinks),
            customSlug: Boolean(e.customSlug),
            suggestedAmounts: Boolean(e.suggestedAmounts),
            socialLinks: Boolean(e.socialLinks),
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    void QRCode.toDataURL(`""/p/${previewSlug}`, {
      width: 200,
      margin: 1,
      color: { dark: "#0B1B32", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [previewSlug]);

  const previewConfig = useMemo((): PaymentPageConfiguration => {
    const enabledMethods = PAYMENT_PROVIDERS
      .filter((p) => methods[p].enabled && methods[p].value.trim())
      .map((p, i) => ({
        id: p,
        provider: p,
        publicHandle: methods[p].value.startsWith("http") ? null : methods[p].value,
        publicUrl: methods[p].value.startsWith("http") ? methods[p].value : null,
        instructions: null,
        uploadedQrImageUrl: null,
        enabled: true,
        sortOrder: i,
      }));

    return {
      id: "preview",
      qrCampaignId: "preview",
      paymentMode: "reusable_page",
      amountMode,
      pageTheme: pageThemeFromPosterTemplate(templateKey),
      purpose: "pay",
      customPurposeLabel: null,
      title: title || HOSTED_PAYMENT_SECTION_HEADING,
      description,
      thankYouMessage: "Thank you for your support!",
      paymentNote: paymentNote.trim() || null,
      logoUrl: logoUrl.trim() || null,
      bannerUrl: bannerUrl.trim() || null,
      primaryColor,
      secondaryColor: null,
      allowCustomAmount: amountMode === "suggested",
      showReviewPrompt: true,
      showPlatformBranding: true,
      googleReviewUrl: googleReviewUrl || null,
      facebookReviewUrl: facebookReviewUrl || null,
      websiteUrl: websiteUrl || null,
      facebookPageUrl: facebookPageUrl || null,
      instagramUrl: instagramUrl || null,
      pinterestUrl: pinterestUrl || null,
      tiktokUrl: null,
      youtubeUrl: null,
      bookingUrl: bookingUrl || null,
      phone: null,
      email: null,
      methods: enabledMethods,
      suggestedAmounts:
        amountMode === "suggested" && entitlements.suggestedAmounts
          ? amounts.map((cents, i) => ({
              id: String(cents),
              amountCents: cents,
              label: null,
              enabled: true,
              sortOrder: i,
            }))
          : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [
    amountMode,
    templateKey,
    title,
    description,
    paymentNote,
    logoUrl,
    bannerUrl,
    primaryColor,
    methods,
    amounts,
    googleReviewUrl,
    facebookReviewUrl,
    websiteUrl,
    facebookPageUrl,
    instagramUrl,
    pinterestUrl,
    bookingUrl,
    entitlements.suggestedAmounts,
  ]);

  const previewCampaign = useMemo((): ReviewQrCampaign => ({
    id: "preview",
    organizationId: null,
    businessId,
    ownerUserId: null,
    campaignType: "payment_review",
    publicSlug: previewSlug,
    name,
    placementType: "standard_poster",
    customPlacementLabel: null,
    destinationUrl: "",
    shortCode: "preview",
    headline: title,
    description,
    brandColor: primaryColor,
    secondaryColor: null,
    templateKey: templateKey,
    printFormat: "letter",
    showFooter: true,
    posterConfig: {
      title: title || HOSTED_PAYMENT_SECTION_HEADING,
      description,
      brandColor: primaryColor,
      showFooter: true,
      format: "letter",
      selectedPhrases: [],
    },
    status: "active",
    claimedAt: null,
    source: "app",
    migratedFromLinkId: null,
    totalScans: 0,
    estimatedUniqueScans: 0,
    botScans: 0,
    lastScannedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }), [businessId, name, title, description, primaryColor, previewSlug, templateKey]);

  async function publish() {
    setSaving(true);
    setError(null);
    try {
      const enabledMethods = PAYMENT_PROVIDERS
        .filter((p) => methods[p].enabled && methods[p].value.trim())
        .map((p, i) => {
          const raw = methods[p].value.trim();
          const def = getPaymentProvider(p);
          const normalized = def.normalizeInput(raw);
          const validated = def.validateInput(normalized);
          if (!validated.ok) {
            throw new Error(`${def.buttonLabel}: ${validated.error}`);
          }
          const isUrl = validated.normalized.startsWith("http");
          return {
            provider: p,
            publicHandle: isUrl ? null : validated.normalized,
            publicUrl: isUrl ? validated.normalized : null,
            enabled: true,
            sortOrder: i,
          };
        });

      if (enabledMethods.length === 0) {
        throw new Error("Enable at least one payment method with a valid destination.");
      }

      const res = await fetch("/api/reputation/payment-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          name: name.trim() || "Pay & Review Page",
          purpose: "pay",
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          paymentNote: paymentNote.trim() || null,
          logoUrl: logoUrl.trim() || null,
          bannerUrl: bannerUrl.trim() || null,
          primaryColor,
          publicSlug: entitlements.customSlug && publicSlug.trim() ? publicSlug.trim() : null,
          amountMode,
          pageTheme: pageThemeFromPosterTemplate(templateKey),
          googleReviewUrl: googleReviewUrl || null,
          facebookReviewUrl: facebookReviewUrl || null,
          websiteUrl: websiteUrl || null,
          facebookPageUrl: facebookPageUrl || null,
          instagramUrl: instagramUrl || null,
          pinterestUrl: pinterestUrl || null,
          bookingUrl: bookingUrl || null,
          methods: enabledMethods,
          suggestedAmounts:
            amountMode === "suggested" && entitlements.suggestedAmounts
              ? amounts.map((cents, i) => ({ amountCents: cents, sortOrder: i }))
              : [],
          allowCustomAmount: amountMode === "suggested",
          showReviewPrompt: true,
          headline: title || HOSTED_PAYMENT_SECTION_HEADING,
          templateKey: templateKey,
        }),
      });
      const json = (await res.json()) as { campaign?: ReviewQrCampaign; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not create page");
      if (json.campaign?.id) router.push(`${base}/${json.campaign.id}`);
      else router.push(base);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create page");
    } finally {
      setSaving(false);
    }
  }

  function canContinue(): boolean {
    if (step === 2) {
      return PAYMENT_PROVIDERS.some((p) => methods[p].enabled && methods[p].value.trim());
    }
    return true;
  }

  return (
    <ReviewsOpusPage className="space-y-6">
      <div>
        <Link href={base} className="text-sm font-medium text-[#64748B] hover:text-[#0B1B32]">
          ← All campaigns
        </Link>
        <h1 className={cn(qrUi.title, "mt-3")}>Create Pay &amp; Review Page</h1>
        <p className={qrUi.subtitle}>
          One hosted page for payment links, reviews, and social connections — delivered by QR or
          shareable link.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => s.id < step && setStep(s.id)}
            className={cn(
              "rounded-xl border px-3.5 py-2 text-xs font-semibold transition",
              step === s.id
                ? "border-[#2563EB] bg-[#EFF6FF] text-[#1D4ED8]"
                : step > s.id
                  ? "border-[#D0D5DD] bg-white text-[#344054]"
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

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className={cn(qrUi.cardPad)}>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#667085]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : null}

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-[#0B1B32]">Business details</h2>
            <div>
              <label className={qrUi.label}>Campaign name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={cn(qrUi.input, "mt-1.5")} />
            </div>
            <div>
              <label className={qrUi.label}>Page heading</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={cn(qrUi.input, "mt-1.5")}
                placeholder="Optional custom heading"
              />
            </div>
            <div>
              <label className={qrUi.label}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={cn(qrUi.input, "mt-1.5 min-h-[80px]")}
                placeholder="Fast, friendly service in your city"
              />
            </div>
            <div>
              <label className={qrUi.label}>Business</label>
              <p className="mt-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm font-semibold">
                {businessName}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={qrUi.label}>Logo URL (optional)</label>
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={cn(qrUi.input, "mt-1.5")} />
              </div>
              <div>
                <label className={qrUi.label}>Cover image URL (optional)</label>
                <input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} className={cn(qrUi.input, "mt-1.5")} />
              </div>
            </div>
            <div>
              <PosterTemplatePicker
                value={templateKey}
                canUsePremium={canUsePremiumTemplates}
                upgradeHref={`/businesses/${businessId}/reputation/qr-campaigns/plans`}
                onChange={(key, meta) => {
                  setTemplateKey(key);
                  setPrimaryColor(getPosterTemplate(key).accent);
                  if (!title.trim()) setTitle(meta.suggestedTitle);
                  if (!description.trim()) setDescription(meta.suggestedDescription);
                }}
              />
              <p className="mt-2 text-xs text-[#64748B]">
                Same theme on your printed poster and hosted page — scan opens payments in the same design.
              </p>
            </div>
            <div>
              <label className={qrUi.label}>Brand color</label>
              <div className="mt-1.5 flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border"
                />
                <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className={qrUi.input} />
              </div>
            </div>
            {entitlements.customSlug && (
              <div>
                <label className={qrUi.label}>Custom page slug</label>
                <input
                  value={publicSlug}
                  onChange={(e) => setPublicSlug(e.target.value.toLowerCase())}
                  className={cn(qrUi.input, "mt-1.5")}
                  placeholder="joes-plumbing"
                />
                <p className="mt-1 text-xs text-[#64748B]">
                  app.localseoexpress.com/p/{publicSlug || "your-slug"}
                </p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-[#0B1B32]">Payment options</h2>
            <p className="text-sm text-[#64748B]">
              Only enabled methods with valid destinations appear on your public page.
            </p>
            {PAYMENT_PROVIDERS.map((provider) => {
              const def = getPaymentProvider(provider);
              const state = methods[provider];
              return (
                <div key={provider} className="rounded-2xl border border-[#E2E8F0] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-[#0B1B32]">{def.buttonLabel}</p>
                      <p className="text-xs text-[#64748B]">{PROVIDER_HINTS[provider]}</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={state.enabled}
                        onChange={(e) =>
                          setMethods((m) => ({
                            ...m,
                            [provider]: { ...m[provider], enabled: e.target.checked },
                          }))
                        }
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-[#E2E8F0] after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:bg-[#2563EB] peer-checked:after:translate-x-5" />
                    </label>
                  </div>
                  {state.enabled && (
                    <input
                      value={state.value}
                      onChange={(e) =>
                        setMethods((m) => ({
                          ...m,
                          [provider]: { ...m[provider], value: e.target.value },
                        }))
                      }
                      className={cn(qrUi.input, "mt-3")}
                      placeholder={PROVIDER_HINTS[provider]}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-[#0B1B32]">Amount settings</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {AMOUNT_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setAmountMode(mode)}
                  className={cn(
                    "rounded-2xl border-2 p-4 text-left text-sm",
                    amountMode === mode
                      ? "border-[#2563EB] bg-[#EFF6FF]"
                      : "border-[#E2E8F0]"
                  )}
                >
                  <p className="font-bold text-[#0B1B32]">{AMOUNT_MODE_LABELS[mode]}</p>
                </button>
              ))}
            </div>
            {amountMode === "suggested" && entitlements.suggestedAmounts && (
              <div>
                <label className={qrUi.label}>Suggested amounts ($)</label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {amounts.map((cents, i) => (
                    <input
                      key={i}
                      type="number"
                      value={cents / 100}
                      onChange={(e) => {
                        const v = Math.round(parseFloat(e.target.value) * 100);
                        setAmounts((a) => a.map((x, j) => (j === i ? v : x)));
                      }}
                      className={qrUi.input}
                    />
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className={qrUi.label}>Optional payment note</label>
              <input
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
                className={cn(qrUi.input, "mt-1.5")}
                placeholder="Shown when amount prefilling is supported"
              />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-[#0B1B32]">Reviews &amp; links</h2>
            <div>
              <label className={qrUi.label}>Google review URL</label>
              <input
                value={googleReviewUrl}
                onChange={(e) => setGoogleReviewUrl(e.target.value)}
                className={cn(qrUi.input, "mt-1.5")}
                disabled={!entitlements.reviewLinks}
              />
            </div>
            <div>
              <label className={qrUi.label}>Facebook review URL</label>
              <input
                value={facebookReviewUrl}
                onChange={(e) => setFacebookReviewUrl(e.target.value)}
                className={cn(qrUi.input, "mt-1.5")}
                disabled={!entitlements.reviewLinks}
              />
            </div>
            {entitlements.socialLinks && (
              <>
                <div>
                  <label className={qrUi.label}>Website</label>
                  <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className={cn(qrUi.input, "mt-1.5")} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={qrUi.label}>Facebook page</label>
                    <input value={facebookPageUrl} onChange={(e) => setFacebookPageUrl(e.target.value)} className={cn(qrUi.input, "mt-1.5")} />
                  </div>
                  <div>
                    <label className={qrUi.label}>Instagram</label>
                    <input value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} className={cn(qrUi.input, "mt-1.5")} />
                  </div>
                  <div>
                    <label className={qrUi.label}>Pinterest</label>
                    <input value={pinterestUrl} onChange={(e) => setPinterestUrl(e.target.value)} className={cn(qrUi.input, "mt-1.5")} />
                  </div>
                  <div>
                    <label className={qrUi.label}>Booking link</label>
                    <input value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} className={cn(qrUi.input, "mt-1.5")} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {step === 5 && (
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-[#0B1B32]">Publish</h2>
              {qrDataUrl && (
                <div className="flex flex-col items-center rounded-2xl border p-6">
                  <img src={qrDataUrl} alt="QR" className="h-40 w-40" />
                  <p className="mt-3 text-xs text-[#64748B]">
                    app.localseoexpress.com/p/{previewSlug}
                  </p>
                </div>
              )}
            </div>
            <div>
              <p className="mb-3 text-sm font-semibold text-[#64748B]">Hosted page preview</p>
              <p className="mb-3 text-xs text-[#64748B]">
                What customers see after scanning — same brand theme as your poster, with tip
                amounts, payment buttons, and Google review.
              </p>
              <BrandThemeHostedPage
                slug={previewSlug}
                campaign={previewCampaign}
                config={previewConfig}
                businessName={businessName}
                isPreview
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          disabled={step <= 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          className={cn(qrUi.btnSecondary, "disabled:opacity-40")}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {step < 5 ? (
          <button
            type="button"
            disabled={!canContinue()}
            onClick={() => setStep((s) => s + 1)}
            className={cn(qrUi.btnPrimary, "disabled:opacity-40")}
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => void publish()}
            className={cn(qrUi.btnPrimary, "bg-[#2563EB] hover:bg-[#1D4ED8]")}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Publish Pay &amp; Review Page
          </button>
        )}
      </div>
    </ReviewsOpusPage>
  );
}
