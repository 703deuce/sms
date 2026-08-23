"use client";

import { Star } from "lucide-react";
import { PaymentPageBackgroundDecor } from "@/components/reputation/payment-qr/payment-page-background-decor";
import {
  PaymentPageFooterWave,
  PaymentPageHeaderDecor,
} from "@/components/reputation/payment-qr/payment-page-header-decor";
import { PaymentProviderIcon } from "@/components/reputation/payment-qr/payment-provider-icons";
import { PaymentThemeLogo } from "@/components/reputation/payment-qr/payment-theme-logos";
import { getPageTheme } from "@/lib/reputation/payment-qr/page-themes";
import type { PageThemeKey } from "@/lib/reputation/payment-qr/types";
import { cn } from "@/lib/utils";

export const PAYMENT_THUMB_HEIGHT = 480;

/**
 * Static illustration for template-picker thumbnails — fixed 360×480 canvas,
 * same pattern as ReviewPosterPreview in poster-template-picker (no live page state).
 */
export function PaymentPageThemeIllustration({
  themeKey,
  businessName,
  description,
}: {
  themeKey: PageThemeKey;
  businessName: string;
  description: string;
}) {
  const theme = getPageTheme(themeKey);
  const isSectionLayout = theme.layoutMode === "dark_sections";
  const logoRing = isSectionLayout ? theme.pageBg : theme.cardBg;
  const logoOverlap =
    theme.headerDecor === "wave"
      ? "-mt-[28px]"
      : theme.headerDecor === "shield" || theme.headerDecor === "dark"
        ? "-mt-8"
        : "-mt-6";

  const pillSamples = ["15%", "18%", "20%"];

  const header = (
    <div className="text-center">
      <PaymentPageHeaderDecor theme={theme} />
      <div className="relative px-4">
        <div className={cn("mx-auto flex justify-center", logoOverlap)}>
          <PaymentThemeLogo
            theme={themeKey}
            businessName={businessName}
            borderColor={logoRing}
          />
        </div>
        <p
          className={cn(
            "font-extrabold leading-tight",
            theme.serifHeading && "font-serif"
          )}
          style={{
            color: theme.textPrimary,
            fontFamily: theme.serifHeading ? theme.headingFontFamily : theme.fontFamily,
            fontSize: theme.headingSize ?? "1.25rem",
          }}
        >
          {businessName}
        </p>
        {description ? (
          <p
            className="mt-0.5 text-[11px] leading-snug"
            style={{ color: theme.taglineColor ?? theme.textMuted }}
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );

  const amounts = (
    <div className="px-4 pt-3">
      <p
        className="text-[9px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: theme.sectionLabel }}
      >
        {theme.amountLabel}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {pillSamples.map((label, i) => (
          <span
            key={label}
            className="border-2 px-3 py-1 text-[10px] font-bold"
            style={{
              borderRadius: theme.pillRadius,
              background: i === 0 ? theme.pillSelectedBg : theme.pillBg,
              borderColor: i === 0 ? theme.pillSelectedBorder : theme.pillBorder,
              color: i === 0 ? theme.pillSelectedText : theme.textPrimary,
              boxShadow: i === 0 ? theme.pillShadow : undefined,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );

  const methods = (
    <div className="px-4 pt-3">
      <p
        className="text-[9px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: theme.sectionLabel }}
      >
        {theme.payLabel}
      </p>
      <div className="mt-2 space-y-1.5">
        {(["venmo", "paypal"] as const).map((provider) => (
          <div
            key={provider}
            className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{
              background: theme.methodCardBg,
              borderColor: theme.methodCardBorder,
            }}
          >
            <PaymentProviderIcon provider={provider} variant={theme.methodIconVariant} />
            <span className="text-[11px] font-semibold" style={{ color: theme.textPrimary }}>
              Pay with {provider === "venmo" ? "Venmo" : "PayPal"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  const review = (
    <div className="px-4 pt-3">
      <p
        className="text-center text-[9px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: theme.sectionLabel }}
      >
        {theme.reviewSectionLabel}
      </p>
      <div
        className="mt-2 border p-3"
        style={{
          borderRadius: theme.buttonRadius,
          background: theme.reviewBoxBg,
          borderColor: theme.reviewBoxBorder,
        }}
      >
        <div className="flex justify-center gap-0.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="h-3 w-3 fill-[#F59E0B] text-[#F59E0B]" />
          ))}
        </div>
        <div
          className="mt-2 flex w-full items-center justify-center py-2 text-[10px] font-bold"
          style={{
            borderRadius: theme.buttonRadius,
            background: theme.googleReviewBg,
            color: theme.googleReviewText,
          }}
        >
          Google Review
        </div>
      </div>
    </div>
  );

  if (isSectionLayout) {
    return (
      <div
        className="overflow-hidden"
        style={{
          width: 360,
          height: PAYMENT_THUMB_HEIGHT,
          background: theme.pageBg,
          fontFamily: theme.fontFamily,
        }}
      >
        {header}
        <div className="mt-2 space-y-2 px-3">
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: theme.cardBg, borderRadius: theme.cardRadius }}
          >
            {amounts}
          </div>
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: theme.cardBg, borderRadius: theme.cardRadius }}
          >
            {methods}
          </div>
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: theme.cardBg, borderRadius: theme.cardRadius }}
          >
            {review}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: 360,
        height: PAYMENT_THUMB_HEIGHT,
        background: theme.pageBg,
        fontFamily: theme.fontFamily,
      }}
    >
      <div className="relative mx-auto px-2 py-2">
        <PaymentPageBackgroundDecor theme={theme} />
        <div
          className="relative overflow-hidden"
          style={{
            background: theme.cardBg,
            borderRadius: theme.cardRadius,
            boxShadow: theme.cardShadow,
          }}
        >
          {header}
          {amounts}
          {methods}
          {review}
          <PaymentPageFooterWave theme={theme} />
        </div>
      </div>
    </div>
  );
}
