"use client";

import { QrCampaignEditor } from "@/components/reputation/qr-campaigns/qr-campaign-editor";

/**
 * Legacy `/reputation/qr` route — tracked QR campaign editor.
 */
export function QrPosterPage({ businessId }: { businessId: string }) {
  return <QrCampaignEditor businessId={businessId} />;
}
