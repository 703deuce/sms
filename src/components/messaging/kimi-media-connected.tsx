/**
 * Backend adapter shell for Kimi messaging/media (MMS campaigns).
 * Reuses campaigns Kimi child components with mass-texting APIs.
 */
"use client";

import { useRouter } from "next/navigation";
import CampaignsList from "@/components/kimi/campaigns/components/CampaignsList";
import CreateCampaign from "@/components/kimi/campaigns/components/CreateCampaign";
import ReviewDetails from "@/components/kimi/campaigns/components/ReviewDetails";
import type { CampaignListRow, CampaignNavPaths, ReviewNavPaths } from "@/lib/campaigns/kimi-campaigns-adapter";

function isMmsCampaign(row: CampaignListRow): boolean {
  const cfg = row.configJson as { mediaUrls?: string[]; steps?: Array<{ config?: { mediaUrls?: string[] } }> } | null;
  if (cfg?.mediaUrls?.length) return true;
  return Boolean(cfg?.steps?.some((s) => s.config?.mediaUrls?.length));
}

export type MediaCampaignsInitialView = "list" | "create" | "review";

const MEDIA_HOME = "/messaging/media";
const mediaCampaignPaths: CampaignNavPaths = {
  homePath: MEDIA_HOME,
  reviewPath: (id) => `${MEDIA_HOME}?view=review&id=${id}`,
};
const mediaReviewPaths: ReviewNavPaths = {
  homePath: MEDIA_HOME,
};

export function KimiMediaConnected({ initialView = "list" }: { initialView?: MediaCampaignsInitialView }) {
  const router = useRouter();

  if (initialView === "create") {
    return (
      <CreateCampaign
        onCancel={() => router.push(MEDIA_HOME)}
        paths={mediaCampaignPaths}
      />
    );
  }

  if (initialView === "review") {
    return (
      <ReviewDetails
        onPrev={() => router.push(`${MEDIA_HOME}?create=1`)}
        paths={mediaReviewPaths}
      />
    );
  }

  return (
    <CampaignsList
      title="MMS Campaigns"
      subtitle="View and manage campaigns that include media attachments."
      rowFilter={isMmsCampaign}
      onCreate={() => router.push(`${MEDIA_HOME}?create=1`)}
      editCampaignPath={(id) => `${MEDIA_HOME}?create=1&edit=${id}`}
    />
  );
}
