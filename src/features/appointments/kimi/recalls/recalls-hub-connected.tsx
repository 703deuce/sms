"use client";

import { useCallback, useEffect, useState } from "react";
import "@/components/appointments/kimi-ui/recalls/reference.css";
import { RecallSavedViewsPanel } from "@/components/appointments/recall-saved-views-panel";
import { RecallsHub } from "@/components/appointments/kimi-ui/recalls/components/RecallsHub";
import type { RecallActivity, RecallStat } from "@/components/appointments/kimi-ui/recalls/types";

type HubData = {
  stats: RecallStat[];
  recallCampaignsMeta: string;
  noShowRecoveryMeta: string;
  activity: RecallActivity[];
};

export function RecallsHubConnected() {
  const [data, setData] = useState<HubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/appointments/recalls/hub");
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setData(json.data as HubData);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <RecallsHub
        stats={data?.stats || []}
        activity={data?.activity || []}
        recallCampaignsMeta={data?.recallCampaignsMeta || ""}
        noShowRecoveryMeta={data?.noShowRecoveryMeta || ""}
        loading={loading}
        refreshError={error}
        onRefresh={load}
      />
      <div className="tv-page pt-0">
        <RecallSavedViewsPanel />
      </div>
    </>
  );
}
