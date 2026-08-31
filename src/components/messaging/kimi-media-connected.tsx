/**
 * Backend adapter shell for Kimi messaging/media (MMS campaigns).
 * Reuses campaigns Kimi child components with mass-texting APIs.
 */
"use client";

import { useRouter } from "next/navigation";
import CampaignsList from "@/components/kimi/campaigns/components/CampaignsList";
import CreateCampaign from "@/components/kimi/campaigns/components/CreateCampaign";
import ReviewDetails from "@/components/kimi/campaigns/components/ReviewDetails";

export type MediaCampaignsInitialView = "list" | "create" | "review";

export function KimiMediaConnected({ initialView = "list" }: { initialView?: MediaCampaignsInitialView }) {
  const router = useRouter();

  if (initialView === "create") {
    return <CreateCampaign onCancel={() => router.push("/messaging/media")} />;
  }

  if (initialView === "review") {
    return <ReviewDetails onPrev={() => router.push("/messaging/media")} />;
  }

  return <CampaignsList onCreate={() => router.push("/messaging/media?create=1")} />;
}
