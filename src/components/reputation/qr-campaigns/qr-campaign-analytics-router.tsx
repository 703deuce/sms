"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { QrCampaignAnalyticsView } from "@/components/reputation/qr-campaigns/qr-campaign-analytics";
import { PaymentQrAnalyticsView } from "@/components/reputation/payment-qr/payment-qr-analytics";
import type { ReviewQrCampaign } from "@/lib/reputation/qr-campaigns/types";

export function QrCampaignAnalyticsRouter({
  businessId,
  campaignId,
}: {
  businessId: string;
  campaignId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [campaign, setCampaign] = useState<ReviewQrCampaign | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reputation/qr-campaigns/${campaignId}?businessId=${businessId}`
      );
      const json = (await res.json()) as { campaign?: ReviewQrCampaign };
      if (res.ok && json.campaign) setCampaign(json.campaign);
    } finally {
      setLoading(false);
    }
  }, [businessId, campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (campaign?.campaignType === "payment_review") {
    return <PaymentQrAnalyticsView businessId={businessId} campaignId={campaignId} />;
  }

  return <QrCampaignAnalyticsView businessId={businessId} campaignId={campaignId} />;
}
