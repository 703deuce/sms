"use client";

/**
 * Backend adapter shell for Kimi campaigns.
 * Wire APIs and navigation here — do not change presentation under components/kimi/campaigns/.
 * User flows + glue checklist: docs/MASS_TEXTING_GLUE_FLOWS.md
 */
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import CampaignsList from "@/components/kimi/campaigns/components/CampaignsList";
import CreateCampaign from "@/components/kimi/campaigns/components/CreateCampaign";
import ReviewDetails from "@/components/kimi/campaigns/components/ReviewDetails";
import { CampaignNavTabs } from "@/components/campaigns/campaign-nav-tabs";
import { startFreshComposeDraft } from "@/lib/campaigns/compose-draft";
import { useCampaignsBasePath, useCampaignsPath } from "@/hooks/use-campaigns-base-path";
import { buildCampaignNavPaths } from "@/lib/products/business-texting-routes";
import {
  BusinessTextingActivationPanel,
  BusinessTextingSenderBadge,
} from "@/components/campaigns/business-texting-activation-panel";
import type { BusinessTextingCampaignStatus } from "@/lib/mass-texting/business-texting-types";

export type CampaignsInitialView = "list" | "create" | "review";

export function KimiCampaignsConnected({
  initialView = "list",
  initialRows = [],
  senderStatus = null,
}: {
  initialView?: CampaignsInitialView;
  initialRows?: import("@/lib/campaigns/kimi-campaigns-adapter").CampaignListRow[];
  senderStatus?: BusinessTextingCampaignStatus | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const campaignsBase = useCampaignsBasePath();
  const campaignsListPath = useCampaignsPath();
  const campaignsNewPath = useCampaignsPath("/new");
  const campaignNavPaths = buildCampaignNavPaths(campaignsBase);
  const [listKey, setListKey] = useState(0);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (
      initialView === "list" &&
      pathname === campaignsListPath &&
      prevPathRef.current !== campaignsListPath
    ) {
      setListKey((k) => k + 1);
    }
    prevPathRef.current = pathname;
  }, [pathname, initialView, campaignsListPath]);

  const senderActive = senderStatus?.active ?? true;

  const navShell = (content: ReactNode) => (
    <div className="kimi-surface kimi-campaigns">
      <div className="border-b border-slate-200/80 bg-white px-8 pt-6">
        {senderStatus?.active && senderStatus.phoneE164 ? (
          <div className="pb-3">
            <BusinessTextingSenderBadge phoneE164={senderStatus.phoneE164} />
          </div>
        ) : null}
        <CampaignNavTabs />
      </div>
      {senderStatus && !senderStatus.active ? (
        <BusinessTextingActivationPanel status={senderStatus} variant="banner" />
      ) : null}
      {content}
    </div>
  );

  if (!senderActive && (initialView === "create" || initialView === "review")) {
    return navShell(
      senderStatus ? (
        <BusinessTextingActivationPanel status={senderStatus} variant="page" />
      ) : (
        <p className="p-8 text-sm text-slate-500">Checking Business Texting status…</p>
      ),
    );
  }

  if (initialView === "create") {
    return navShell(
      <CreateCampaign
        onCancel={() => router.push(campaignsListPath)}
        paths={campaignNavPaths}
      />,
    );
  }

  if (initialView === "review") {
    return navShell(
      <ReviewDetails
        onPrev={(campaignId) =>
          router.push(campaignId ? campaignNavPaths.editPath(campaignId) : campaignsNewPath)
        }
        paths={campaignNavPaths}
      />,
    );
  }

  return navShell(
    <CampaignsList
      key={listKey}
      initialRows={initialRows}
      campaignsBasePath={campaignsBase}
      senderActive={senderActive}
      onCreate={() => {
        if (!senderActive) {
          router.push("/settings/messaging");
          return;
        }
        startFreshComposeDraft();
        router.push(campaignsNewPath);
      }}
    />,
  );
}
