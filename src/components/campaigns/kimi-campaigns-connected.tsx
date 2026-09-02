/**
 * Backend adapter shell for Kimi campaigns.
 * Reuses unchanged Kimi campaign components wired via lib/campaigns/kimi-campaigns-adapter.
 */
"use client";

import { useRouter } from "next/navigation";
import CampaignsList from "@/components/kimi/campaigns/components/CampaignsList";
import CreateCampaign from "@/components/kimi/campaigns/components/CreateCampaign";
import ReviewDetails from "@/components/kimi/campaigns/components/ReviewDetails";
import { startFreshComposeDraft } from "@/lib/campaigns/compose-draft";

export type CampaignsInitialView = "list" | "create" | "review";

export function KimiCampaignsConnected({ initialView = "list" }: { initialView?: CampaignsInitialView }) {
  const router = useRouter();

  if (initialView === "create") {
    return <CreateCampaign onCancel={() => router.push("/campaigns")} />;
  }

  if (initialView === "review") {
    return <ReviewDetails onPrev={() => router.push("/campaigns/new")} />;
  }

  return <CampaignsList onCreate={() => { startFreshComposeDraft(); router.push("/campaigns/new"); }} />;
}
