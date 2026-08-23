"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import {
  ChevronRight,
  Copy,
  Check,
  Mail,
  Phone,
  Star,
} from "lucide-react";
import { getPaymentProvider } from "@/lib/reputation/payment-qr/providers";
import { getPageTheme } from "@/lib/reputation/payment-qr/page-themes";
import { PaymentPageBackgroundDecor } from "@/components/reputation/payment-qr/payment-page-background-decor";
import {
  PaymentPageFooterWave,
  PaymentPageHeaderDecor,
} from "@/components/reputation/payment-qr/payment-page-header-decor";
import { PaymentThemeLogo } from "@/components/reputation/payment-qr/payment-theme-logos";
import { PaymentProviderIcon, GoogleMarkIcon } from "@/components/reputation/payment-qr/payment-provider-icons";
import { SocialLinkIcon } from "@/components/reputation/payment-qr/payment-social-icons";
import {
  HOSTED_PAYMENT_SECTION_HEADING,
  HOSTED_PAYMENT_DISCLAIMER,
  PROVIDER_CLICK_EVENTS,
  type AmountMode,
  type PaymentPageConfiguration,
  type PaymentProvider,
  type PaymentRequestSession,
  type PageThemeKey,
} from "@/lib/reputation/payment-qr/types";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";
import { cn } from "@/lib/utils";

function sessionId(): string {
  if (typeof window === "undefined") return "server";
  const key = "lse_pay_sid";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

async function trackEvent(
  slug: string,
  eventType: string,
  extra?: {
    provider?: PaymentProvider;
    amountSelectedCents?: number;
    metadata?: Record<string, string>;
  }
) {
  try {
    await fetch("/api/public/payment-qr/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        eventType,
        sessionId: sessionId(),
        provider: extra?.provider,
        amountSelectedCents: extra?.amountSelectedCents,
        metadata: extra?.metadata,
      }),
    });
  } catch {
    // non-blocking
  }
}

function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatAmountLabel(amountCents: number, label: string | null): string {
  if (label?.trim()) return label.trim();
  return `$${(amountCents / 100).toFixed(0)}`;
}

function SectionLabel({
  children,
  theme,
  className,
}: {
  children: string;
  theme: ReturnType<typeof getPageTheme>;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.12em]",
        className
      )}
      style={{ color: theme.sectionLabel }}
    >
      {children}
    </p>
  );
}

function SectionCard({
  theme,
  children,
  className,
}: {
  theme: ReturnType<typeof getPageTheme>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("px-5 py-5 sm:px-6", className)}
      style={{
        background: theme.cardBg,
        borderRadius: theme.cardRadius,
        boxShadow: theme.layoutMode === "dark_sections" ? "0 4px 20px rgba(0,0,0,0.35)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

export function PaymentPublicPage({
  slug,
  campaign,
  config,
  businessName,
  isPreview = false,
  requestSession = null,
  themeOverride,
  compact = false,
}: {
  slug: string;
  campaign: ReviewQrCampaign;
  config: PaymentPageConfiguration;
  businessName: string;
  isPreview?: boolean;
  requestSession?: PaymentRequestSession | null;
  themeOverride?: PageThemeKey;
  /** Scaled-down layout for template picker thumbnails */
  compact?: boolean;
}) {
  const [selectedAmountCents, setSelectedAmountCents] = useState<number | null>(() => {
    if (!isPreview) return null;
    const first = config.suggestedAmounts
      .filter((a) => a.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return first?.amountCents ?? null;
  });
  const [customAmount, setCustomAmount] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [zelleExpanded, setZelleExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const theme = getPageTheme(themeOverride ?? config.pageTheme);
  const amountMode: AmountMode = requestSession ? "suggested" : config.amountMode;
  const lockedAmountCents = requestSession?.amountCents ?? null;
  const lockedNote = requestSession?.note ?? config.paymentNote ?? null;

  const heading =
    config.purpose === "custom" && config.customPurposeLabel
      ? config.customPurposeLabel
      : null;

  const enabledMethods = useMemo(
    () =>
      config.methods
        .filter((m) => m.enabled && (m.publicHandle?.trim() || m.publicUrl?.trim()))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(compact ? 2 : undefined),
    [config.methods, compact]
  );

  const enabledAmounts = useMemo(
    () =>
      config.suggestedAmounts
        .filter((a) => a.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [config.suggestedAmounts]
  );

  const effectiveAmountCents = useMemo(() => {
    if (lockedAmountCents) return lockedAmountCents;
    if (amountMode === "none") return null;
    if (selectedAmountCents) return selectedAmountCents;
    if (customAmount) {
      const parsed = parseFloat(customAmount);
      if (!Number.isNaN(parsed) && parsed > 0) return Math.round(parsed * 100);
    }
    return null;
  }, [lockedAmountCents, amountMode, selectedAmountCents, customAmount]);

  const requiresAmount = amountMode !== "none" && !lockedAmountCents;

  useEffect(() => {
    if (isPreview) return;
    void trackEvent(slug, "page_view");
    const fromQr = document.referrer.includes("/r/") || document.referrer.includes("/go/");
    if (fromQr) void trackEvent(slug, "qr_scan");
  }, [slug, isPreview]);

  const copyText = async (field: string, text: string, eventType?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      if (!isPreview && eventType) void trackEvent(slug, eventType);
    } catch {
      // ignore
    }
  };

  const handlePaymentClick = useCallback(
    async (provider: PaymentProvider) => {
      const amount = effectiveAmountCents;
      if (requiresAmount && (!amount || amount <= 0)) return;

      if (provider === "zelle") {
        setZelleExpanded(true);
        if (!isPreview) {
          void trackEvent(slug, PROVIDER_CLICK_EVENTS.zelle, {
            provider,
            amountSelectedCents: amount ?? undefined,
          });
        }
        return;
      }

      if (isPreview) return;

      const res = await fetch("/api/public/payment-qr/open-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          provider,
          amountCents: amount,
          note: lockedNote,
          sessionId: sessionId(),
        }),
      });

      const json = (await res.json()) as { destinationUrl?: string | null };
      if (!res.ok) return;
      if (json.destinationUrl) {
        window.open(json.destinationUrl, "_blank", "noopener,noreferrer");
      }
    },
    [slug, effectiveAmountCents, lockedNote, requiresAmount, isPreview]
  );

  const handleReviewClick = async (type: "google" | "facebook", url: string) => {
    if (!isPreview) {
      await trackEvent(
        slug,
        type === "google" ? "google_review_clicked" : "facebook_review_clicked"
      );
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSocialClick = async (
    eventType: "website_clicked" | "booking_link_clicked" | "social_link_clicked",
    url: string,
    linkType: string
  ) => {
    if (!isPreview) {
      await trackEvent(slug, eventType, { metadata: { linkType } });
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const zelleMethod = enabledMethods.find((m) => m.provider === "zelle");
  const zelleRecipient = zelleMethod?.publicHandle ?? "";
  const showReviews =
    Boolean(config.googleReviewUrl) || Boolean(config.facebookReviewUrl);

  const socialLinks = [
    config.instagramUrl && { type: "instagram", url: config.instagramUrl },
    config.facebookPageUrl && { type: "facebook", url: config.facebookPageUrl },
    config.pinterestUrl && { type: "pinterest", url: config.pinterestUrl },
    config.tiktokUrl && { type: "tiktok", url: config.tiktokUrl },
    config.youtubeUrl && { type: "youtube", url: config.youtubeUrl },
    config.websiteUrl && { type: "website", url: config.websiteUrl },
    config.bookingUrl && { type: "booking", url: config.bookingUrl },
  ].filter(Boolean) as Array<{ type: string; url: string }>;

  const isSectionLayout = theme.layoutMode === "dark_sections";

  const logoOverlap =
    theme.headerDecor === "wave"
      ? "-mt-[34px]"
      : theme.headerDecor === "shield" || theme.headerDecor === "dark"
        ? "-mt-10"
        : "-mt-8";
  const logoRing = isSectionLayout ? theme.pageBg : theme.cardBg;

  const logoBlock = config.logoUrl ? (
    <div
      className={cn(
        "mx-auto mb-3 flex items-center justify-center overflow-hidden rounded-full border-[3px] shadow-lg",
        logoOverlap,
        "h-[68px] w-[68px]"
      )}
      style={{ borderColor: logoRing, background: theme.cardBg }}
    >
      <Image
        src={config.logoUrl}
        alt=""
        width={68}
        height={68}
        className="h-full w-full object-cover"
        unoptimized
      />
    </div>
  ) : (
    <div className={cn("mx-auto mb-3 flex justify-center", logoOverlap)}>
      <PaymentThemeLogo
        theme={theme.key}
        businessName={businessName}
        borderColor={logoRing}
      />
    </div>
  );

  const headerBlock = (
    <div className="text-center">
      <div className="relative">
        {config.bannerUrl ? (
          <div className="relative h-28 w-full">
            <Image src={config.bannerUrl} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <PaymentPageHeaderDecor theme={theme} />
        )}
      </div>

      <div className={cn(isSectionLayout ? "px-5" : "px-5 sm:px-6", "relative z-[0]")}>
        {logoBlock}
        <h1
          className={cn(
            "font-extrabold leading-tight tracking-tight",
            theme.serifHeading && "font-serif"
          )}
          style={{
            color: theme.textPrimary,
            fontFamily: theme.serifHeading ? theme.headingFontFamily : theme.fontFamily,
            fontSize: theme.headingSize ?? "1.625rem",
          }}
        >
          {businessName}
        </h1>
        {config.description ? (
          <p
            className="mt-1 text-sm leading-relaxed"
            style={{ color: theme.taglineColor ?? theme.textMuted }}
          >
            {config.description}
          </p>
        ) : null}
        {heading ? (
          <p
            className="mt-1.5 text-sm font-semibold"
            style={{ color: theme.textSecondary }}
          >
            {heading}
          </p>
        ) : null}
      </div>
    </div>
  );

  const amountBlock =
    lockedAmountCents ? (
      <div
        className="rounded-2xl border px-4 py-4 text-center"
        style={{
          borderColor: theme.pillBorder,
          background: theme.pillBg,
        }}
      >
        <SectionLabel theme={theme} className="text-center">Amount</SectionLabel>
        <p
          className="mt-1 text-3xl font-extrabold"
          style={{ color: theme.textPrimary }}
        >
          {formatMoney(lockedAmountCents)}
        </p>
        {lockedNote ? (
          <p className="mt-2 text-sm" style={{ color: theme.textMuted }}>{lockedNote}</p>
        ) : null}
      </div>
    ) : amountMode === "suggested" && enabledAmounts.length > 0 ? (
      <div>
        <SectionLabel theme={theme}>{theme.amountLabel}</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {enabledAmounts.map((a) => {
            const selected = selectedAmountCents === a.amountCents && !showCustomInput;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setSelectedAmountCents(a.amountCents);
                  setCustomAmount("");
                  setShowCustomInput(false);
                  if (!isPreview) {
                    void trackEvent(slug, "amount_selected", {
                      amountSelectedCents: a.amountCents,
                    });
                  }
                }}
                className="border-2 px-4 py-2 text-sm font-bold transition hover:opacity-90"
                style={{
                  borderRadius: theme.pillRadius,
                  background: selected ? theme.pillSelectedBg : theme.pillBg,
                  borderColor: selected ? theme.pillSelectedBorder : theme.pillBorder,
                  color: selected
                    ? theme.pillSelectedText
                    : theme.key === "floral_pink"
                      ? "#FFFFFF"
                      : theme.textPrimary,
                  boxShadow: selected
                    ? theme.key === "floral_pink"
                      ? "0 6px 18px rgba(190, 24, 93, 0.35)"
                      : theme.key === "modern_blue"
                        ? "0 4px 14px rgba(37, 99, 235, 0.3)"
                        : theme.pillShadow
                    : theme.pillShadow,
                }}
              >
                {formatAmountLabel(a.amountCents, a.label)}
              </button>
            );
          })}
          {config.allowCustomAmount && (
            <button
              type="button"
              onClick={() => {
                setShowCustomInput(true);
                setSelectedAmountCents(null);
              }}
              className="border-2 px-4 py-2 text-sm font-bold transition hover:opacity-90"
              style={{
                borderRadius: theme.pillRadius,
                background: showCustomInput ? theme.pillSelectedBg : theme.pillBg,
                borderColor: showCustomInput ? theme.pillSelectedBorder : theme.pillBorder,
                color: showCustomInput
                  ? theme.pillSelectedText
                  : theme.key === "floral_pink"
                    ? "#FFFFFF"
                    : theme.textSecondary,
                boxShadow:
                  theme.pillShadow && theme.key === "floral_pink" && !showCustomInput
                    ? theme.pillShadow
                    : undefined,
              }}
            >
              Other
            </button>
          )}
        </div>
        {showCustomInput && (
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Enter custom amount"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            onBlur={() => {
              if (!isPreview && customAmount) {
                const parsed = parseFloat(customAmount);
                if (!Number.isNaN(parsed) && parsed > 0) {
                  void trackEvent(slug, "custom_amount_entered", {
                    amountSelectedCents: Math.round(parsed * 100),
                  });
                }
              }
            }}
            className="mt-3 w-full border px-4 py-3 text-center text-sm outline-none focus:ring-2"
            style={{
              borderRadius: theme.buttonRadius,
              borderColor: theme.pillBorder,
              background: theme.pillBg,
              color: theme.textPrimary,
            }}
          />
        )}
      </div>
    ) : amountMode === "custom" ? (
      <div>
        <SectionLabel theme={theme}>Enter payment amount</SectionLabel>
        <div
          className="mt-2 flex items-center border px-4 py-3"
          style={{
            borderRadius: theme.buttonRadius,
            borderColor: theme.pillBorder,
            background: theme.pillBg,
          }}
        >
          <span className="text-lg font-bold" style={{ color: theme.textMuted }}>$</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            onBlur={() => {
              if (!isPreview && customAmount) {
                const parsed = parseFloat(customAmount);
                if (!Number.isNaN(parsed) && parsed > 0) {
                  void trackEvent(slug, "custom_amount_entered", {
                    amountSelectedCents: Math.round(parsed * 100),
                  });
                }
              }
            }}
            className="ml-2 w-full bg-transparent text-lg font-semibold outline-none"
            style={{ color: theme.textPrimary }}
          />
        </div>
      </div>
    ) : null;

  const methodsBlock = enabledMethods.length > 0 && (
    <div>
      <SectionLabel theme={theme}>{HOSTED_PAYMENT_SECTION_HEADING}</SectionLabel>
      <div
        className={cn(
          "mt-2",
          !isSectionLayout && "rounded-xl border px-2.5 py-0.5",
        )}
        style={
          isSectionLayout
            ? undefined
            : {
                borderColor: theme.methodCardBorder,
                background: theme.methodCardBg,
              }
        }
      >
        {enabledMethods
          .filter((m) => m.provider !== "zelle" || !zelleExpanded)
          .map((method, idx) => {
            const def = getPaymentProvider(method.provider);
            const blocked =
              requiresAmount && (!effectiveAmountCents || effectiveAmountCents <= 0);
            const isLast =
              idx ===
              enabledMethods.filter((m) => m.provider !== "zelle" || !zelleExpanded).length - 1;
            return (
              <button
                key={method.id}
                type="button"
                disabled={blocked}
                onClick={() => void handlePaymentClick(method.provider)}
                className={cn(
                  "flex w-full items-center gap-2.5 py-2.5 text-left transition",
                  blocked && "cursor-not-allowed opacity-50"
                )}
                style={
                  !isLast
                    ? { borderBottom: `1px solid ${theme.methodCardBorder}` }
                    : undefined
                }
              >
                <PaymentProviderIcon
                  provider={method.provider}
                  variant={theme.methodIconVariant}
                />
                <span
                  className="flex-1 text-[14px] font-semibold leading-snug"
                  style={{ color: theme.textPrimary }}
                >
                  {def.buttonLabel}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 opacity-45"
                  style={{ color: theme.textMuted }}
                />
              </button>
            );
          })}
      </div>
    </div>
  );

  const zelleBlock = zelleExpanded && zelleRecipient && (
    <div
      className="rounded-2xl border p-4 text-sm"
      style={{
        borderColor: theme.methodCardBorder,
        background: theme.methodCardBg,
      }}
    >
      <p className="font-bold" style={{ color: theme.textPrimary }}>Pay with Zelle</p>
      <p className="mt-1 text-xs" style={{ color: theme.textMuted }}>Send payment to:</p>
      <p className="mt-2 font-semibold" style={{ color: theme.textPrimary }}>
        {zelleRecipient}
      </p>
      {effectiveAmountCents ? (
        <p className="mt-3 text-xs" style={{ color: theme.textMuted }}>
          Selected amount:{" "}
          <span className="font-semibold" style={{ color: theme.textPrimary }}>
            {formatMoney(effectiveAmountCents)}
          </span>
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyText("zelle-email", zelleRecipient, "zelle_email_copied")}
          className="inline-flex items-center gap-1 border px-3 py-2 text-xs font-semibold"
          style={{
            borderRadius: theme.buttonRadius,
            borderColor: theme.methodCardBorder,
            background: theme.cardBg,
            color: theme.textPrimary,
          }}
        >
          {copiedField === "zelle-email" ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          Copy email/phone
        </button>
        {effectiveAmountCents ? (
          <button
            type="button"
            onClick={() =>
              void copyText(
                "zelle-amount",
                formatMoney(effectiveAmountCents),
                "zelle_amount_copied"
              )
            }
            className="inline-flex items-center gap-1 border px-3 py-2 text-xs font-semibold"
            style={{
              borderRadius: theme.buttonRadius,
              borderColor: theme.methodCardBorder,
              background: theme.cardBg,
              color: theme.textPrimary,
            }}
          >
            {copiedField === "zelle-amount" ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Copy amount
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setZelleExpanded(false)}
        className="mt-3 text-xs font-semibold"
        style={{ color: theme.textMuted }}
      >
        Back to payment methods
      </button>
    </div>
  );

  const reviewsBlock = showReviews && (
    <div>
      <SectionLabel theme={theme} className="text-center">
        {theme.reviewSectionLabel}
      </SectionLabel>
      <div
        className="mt-2 border p-4"
        style={{
          borderRadius: theme.buttonRadius,
          background: theme.reviewBoxBg,
          borderColor: theme.reviewBoxBorder,
          boxShadow:
            theme.key === "floral_pink"
              ? "0 8px 28px rgba(214, 51, 132, 0.1)"
              : undefined,
        }}
      >
      <div className="flex items-center justify-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className="h-3.5 w-3.5 fill-[#F59E0B] text-[#F59E0B]"
          />
        ))}
      </div>
      <p
        className="mt-2 text-center text-[14px] font-bold leading-snug"
        style={{ color: theme.textPrimary }}
      >
        {theme.reviewPrompt}
      </p>
      <p
        className="mt-0.5 text-center text-[11px] leading-snug"
        style={{ color: theme.textMuted }}
      >
        {theme.reviewSubtext}
      </p>
      {config.googleReviewUrl && (
        <button
          type="button"
          onClick={() => void handleReviewClick("google", config.googleReviewUrl!)}
          className="mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm font-bold transition hover:opacity-95"
          style={{
            borderRadius: theme.buttonRadius,
            background: theme.googleReviewBg,
            color: theme.googleReviewText,
            boxShadow:
              theme.googleReviewShadow ??
              (theme.key === "dark_luxury" ? `0 4px 20px ${theme.primary}40` : undefined),
          }}
        >
          <GoogleMarkIcon className="h-5 w-5 shrink-0" />
          Leave a Google Review
        </button>
      )}
      {!compact && config.facebookReviewUrl && (
        <button
          type="button"
          onClick={() => void handleReviewClick("facebook", config.facebookReviewUrl!)}
          className="mt-2 flex w-full items-center justify-center border-2 py-2.5 text-sm font-bold transition hover:opacity-95"
          style={{
            borderRadius: theme.buttonRadius,
            background: theme.facebookReviewBg,
            color: theme.facebookReviewText,
            borderColor: theme.facebookReviewBorder ?? theme.facebookReviewBg,
          }}
        >
          Leave a Facebook Review
        </button>
      )}
      </div>
    </div>
  );

  const socialBlock = !compact &&
    (socialLinks.length > 0 || config.phone || config.email) && (
    <div>
      <SectionLabel theme={theme} className="text-center">Follow us</SectionLabel>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {socialLinks.map((link) => (
          <button
            key={link.type}
            type="button"
            onClick={() =>
              void handleSocialClick(
                link.type === "website"
                  ? "website_clicked"
                  : link.type === "booking"
                    ? "booking_link_clicked"
                    : "social_link_clicked",
                link.url,
                link.type
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-full border transition hover:opacity-90"
            style={{
              background: theme.socialPillBg,
              borderColor: theme.socialPillBorder,
              color: theme.socialPillText,
            }}
            title={link.type}
          >
            <SocialLinkIcon type={link.type} />
          </button>
        ))}
        {config.phone && (
          <a
            href={`tel:${config.phone}`}
            onClick={() =>
              !isPreview &&
              void trackEvent(slug, "social_link_clicked", { metadata: { linkType: "phone" } })
            }
            className="flex h-11 w-11 items-center justify-center rounded-full border"
            style={{
              background: theme.socialPillBg,
              borderColor: theme.socialPillBorder,
              color: theme.socialPillText,
            }}
          >
            <Phone className="h-5 w-5" />
          </a>
        )}
        {config.email && (
          <a
            href={`mailto:${config.email}`}
            onClick={() =>
              !isPreview &&
              void trackEvent(slug, "social_link_clicked", { metadata: { linkType: "email" } })
            }
            className="flex h-11 w-11 items-center justify-center rounded-full border"
            style={{
              background: theme.socialPillBg,
              borderColor: theme.socialPillBorder,
              color: theme.socialPillText,
            }}
          >
            <Mail className="h-5 w-5" />
          </a>
        )}
      </div>
    </div>
  );

  const footerBlock = !compact && (
    <>
      <p
        className="mt-4 text-center text-[9px] leading-tight"
        style={{ color: theme.disclaimer, opacity: 0.85 }}
      >
        {HOSTED_PAYMENT_DISCLAIMER}
      </p>
      {config.showPlatformBranding && (
        <p
          className="mt-1 text-center text-[9px] leading-tight"
          style={{ color: theme.disclaimer, opacity: 0.7 }}
        >
          Powered by Local SEO Express
        </p>
      )}
    </>
  );

  const pageBottomPad = "pb-[calc(32px+env(safe-area-inset-bottom,0px))]";

  if (isSectionLayout) {
    return (
      <main
        className={cn(compact ? "min-h-0" : "min-h-screen", pageBottomPad)}
        style={{ background: theme.pageBg, fontFamily: theme.fontFamily }}
      >
        <div className={cn("mx-auto px-3 py-4 sm:px-4", compact ? "max-w-[360px] py-3" : "max-w-md sm:py-5")}>
          {headerBlock}

          <div className="mt-4 space-y-3">
            {amountBlock && (
              <SectionCard theme={theme}>{amountBlock}</SectionCard>
            )}

            {methodsBlock && (
              <SectionCard theme={theme}>
                {methodsBlock}
                {requiresAmount && !effectiveAmountCents && !isPreview && !compact && (
                  <p className="mt-3 text-center text-xs text-[#F59E0B]">
                    Select or enter an amount before choosing a payment method.
                  </p>
                )}
                {zelleBlock}
              </SectionCard>
            )}

            {reviewsBlock && <SectionCard theme={theme}>{reviewsBlock}</SectionCard>}

            {(socialBlock || footerBlock) && !compact && (
              <SectionCard theme={theme} className="pb-6">
                {socialBlock}
                {footerBlock}
              </SectionCard>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={cn(compact ? "min-h-0" : "min-h-screen", pageBottomPad)}
      style={{ background: theme.pageBg, fontFamily: theme.fontFamily }}
    >
      <div
        className={cn(
          "relative mx-auto px-3 py-4 sm:px-4",
          compact ? "max-w-[360px] py-3" : "max-w-md sm:py-6"
        )}
      >
        <PaymentPageBackgroundDecor theme={theme} />
        <div
          className="relative overflow-visible"
          style={{
            background: theme.cardBg,
            borderRadius: theme.cardRadius,
            boxShadow: theme.cardShadow,
          }}
        >
          {headerBlock}

          <div className="px-5 pb-4 pt-2 sm:px-6">
            {amountBlock && <div className="mt-3">{amountBlock}</div>}

            {methodsBlock && (
              <div className="mt-4">
                {methodsBlock}
                {requiresAmount && !effectiveAmountCents && !isPreview && !compact && (
                  <p className="mt-2 text-center text-[11px] text-[#B45309]">
                    Select or enter an amount before choosing a payment method.
                  </p>
                )}
              </div>
            )}

            {zelleBlock && <div className="mt-3">{zelleBlock}</div>}

            {reviewsBlock && <div className="mt-4">{reviewsBlock}</div>}

            {socialBlock && <div className="mt-4">{socialBlock}</div>}

            {footerBlock}
          </div>

            {!compact ? <PaymentPageFooterWave theme={theme} /> : <PaymentPageFooterWave theme={theme} />}
        </div>
      </div>
    </main>
  );
}
