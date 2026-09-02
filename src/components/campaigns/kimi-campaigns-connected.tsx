"use client";

import { useRouter } from "next/navigation";
import CampaignsList from "@/components/kimi/campaigns/components/CampaignsList";
import CreateCampaign from "@/components/kimi/campaigns/components/CreateCampaign";
import ReviewDetails from "@/components/kimi/campaigns/components/ReviewDetails";
import { CampaignNavTabs } from "@/components/campaigns/campaign-nav-tabs";
import { startFreshComposeDraft } from "@/lib/campaigns/compose-draft";

export type CampaignsInitialView = "list" | "create" | "review";

export function KimiCampaignsConnected({ initialView = "list" }: { initialView?: CampaignsInitialView }) {
  const router = useRouter();

  if (initialView === "create") {
    return <CreateCampaign onCancel={() => router.push("/campaigns")} />;
  }

  if (initialView === "review") {
    return (
      <ReviewDetails
        onPrev={(campaignId) =>
          router.push(campaignId ? `/campaigns/new?edit=${campaignId}` : "/campaigns/new")
        }
      />
    );
  }

  return (
    <div>
      <div className="border-b border-slate-200/80 bg-white px-8 pt-6">
        <CampaignNavTabs />
      </div>
      <CampaignsList
        onCreate={() => {
          startFreshComposeDraft();
          router.push("/campaigns/new");
        }}
      />
    </div>
  );
}
