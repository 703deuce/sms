"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CampaignsListOpus } from "@/newui-transplant/components/campaigns/campaigns-list-opus";
import { CreateCampaignOpus } from "@/newui-transplant/components/campaigns/create-campaign-opus";
import { ReviewDetailsOpus } from "@/newui-transplant/components/campaigns/review-details-opus";
import { CampaignsOpusShell } from "@/newui-transplant/connected/campaigns/campaigns-opus-shell";
import { startFreshComposeDraft } from "@/lib/campaigns/compose-draft";
import type { CampaignListRow } from "@/lib/campaigns/kimi-campaigns-adapter";

export type CampaignsInitialView = "list" | "create" | "review";

export function CampaignsConnectedOpus({
  initialView = "list",
  initialRows = [],
  listTitle,
  listSubtitle,
  defaultFilter,
  lockFilter,
  rowFilter,
  fetchStatus,
}: {
  initialView?: CampaignsInitialView;
  initialRows?: CampaignListRow[];
  listTitle?: string;
  listSubtitle?: string;
  defaultFilter?: string;
  lockFilter?: boolean;
  rowFilter?: (row: CampaignListRow) => boolean;
  fetchStatus?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [listKey, setListKey] = useState(0);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (
      initialView === "list" &&
      pathname === "/campaigns" &&
      prevPathRef.current !== "/campaigns"
    ) {
      setListKey((k) => k + 1);
    }
    prevPathRef.current = pathname;
  }, [pathname, initialView]);

  const shell = (content: ReactNode, wide?: boolean) => (
    <CampaignsOpusShell wide={wide}>{content}</CampaignsOpusShell>
  );

  if (initialView === "create") {
    return shell(<CreateCampaignOpus onCancel={() => router.push("/campaigns")} />, true);
  }

  if (initialView === "review") {
    return shell(
      <ReviewDetailsOpus
        onPrev={(campaignId) =>
          router.push(campaignId ? `/campaigns/new?edit=${campaignId}` : "/campaigns/new")
        }
      />,
      true,
    );
  }

  return shell(
    <CampaignsListOpus
      key={listKey}
      initialRows={initialRows}
      title={listTitle}
      subtitle={listSubtitle}
      defaultFilter={defaultFilter}
      lockFilter={lockFilter}
      rowFilter={rowFilter}
      fetchStatus={fetchStatus}
      onCreate={() => {
        startFreshComposeDraft();
        router.push("/campaigns/new");
      }}
    />,
  );
}
