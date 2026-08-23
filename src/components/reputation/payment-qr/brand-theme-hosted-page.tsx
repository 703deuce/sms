"use client";

import { PaymentPublicPage } from "@/components/reputation/payment-qr/payment-public-page";
import { pageThemeFromPosterTemplate } from "@/lib/reputation/brand-themes";
import type { PaymentPageConfiguration, PaymentRequestSession } from "@/lib/reputation/payment-qr/types";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";

/**
 * Hosted Pay & Review page — full mobile layout (tip pills, payment buttons, review CTA)
 * with colors and chrome derived from the selected poster `template_key`.
 */
export function BrandThemeHostedPage({
  slug,
  campaign,
  config,
  businessName,
  isPreview = false,
  requestSession = null,
}: {
  slug: string;
  campaign: ReviewQrCampaign;
  config: PaymentPageConfiguration;
  businessName: string;
  isPreview?: boolean;
  requestSession?: PaymentRequestSession | null;
}) {
  const pageTheme = pageThemeFromPosterTemplate(campaign.templateKey);
  const mergedConfig: PaymentPageConfiguration = {
    ...config,
    pageTheme,
    primaryColor: config.primaryColor ?? campaign.brandColor ?? config.primaryColor,
  };

  return (
    <PaymentPublicPage
      slug={slug}
      campaign={campaign}
      config={mergedConfig}
      businessName={businessName}
      isPreview={isPreview}
      requestSession={requestSession}
      themeOverride={pageTheme}
    />
  );
}
