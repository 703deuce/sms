"use client";

import { campaignTabs } from "@/lib/campaign-tabs";
import { useEffect, useState } from "react";

export function useCampaignTabs() {
  const [tabs, setTabs] = useState(campaignTabs);

  useEffect(() => {
    fetch("/api/mass-texting/billing")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) {
          setTabs(campaignTabs.filter((tab) => tab.href !== "/campaigns/recurring"));
        }
      })
      .catch(() => undefined);
  }, []);

  return tabs;
}
