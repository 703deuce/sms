"use client";

/**
 * Backend adapter shell for Kimi campaigns.
 * Wire APIs and navigation here — do not change presentation under components/kimi/campaigns/.
 */
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import CampaignsList from "@/components/kimi/campaigns/components/CampaignsList";
import CreateCampaign from "@/components/kimi/campaigns/components/CreateCampaign";
import ReviewDetails from "@/components/kimi/campaigns/components/ReviewDetails";
import { CampaignNavTabs } from "@/components/campaigns/campaign-nav-tabs";
import { startFreshComposeDraft } from "@/lib/campaigns/compose-draft";

export type CampaignsInitialView = "list" | "create" | "review";

export function KimiCampaignsConnected({ initialView = "list" }: { initialView?: CampaignsInitialView }) {
  const router = useRouter();

  const navShell = (content: ReactNode) => (
    <div className="kimi-surface kimi-campaigns">
      <div className="border-b border-slate-200/80 bg-white px-8 pt-6">
        <CampaignNavTabs />
      </div>
      {content}
    </div>
  );

  if (initialView === "create") {
    return navShell(<CreateCampaign onCancel={() => router.push("/campaigns")} />);
  }

  if (initialView === "review") {
    return navShell(
      <ReviewDetails
        onPrev={(campaignId) =>
          router.push(campaignId ? `/campaigns/new?edit=${campaignId}` : "/campaigns/new")
        }
      />,
    );
  }

  return navShell(
    <CampaignsList
      onCreate={() => {
        startFreshComposeDraft();
        router.push("/campaigns/new");
      }}
    />,
  );
}
