"use client";

import { campaignTabs, getClientCampaignTabs } from "@/lib/campaign-tabs";
import { useEffect, useState } from "react";

export function useCampaignTabs() {
  const [tabs, setTabs] = useState(campaignTabs);

  useEffect(() => {
    fetch("/api/mass-texting/billing")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) {
          setTabs(getClientCampaignTabs());
        }
      })
      .catch(() => undefined);
  }, []);

  return tabs;
}
