"use client";

import { useEffect, useState } from "react";
import { TransplantMctbMissedCallsPage } from "@/newui-transplant/mirror/routes/mctb/missed-calls/page";
import { mapMctbMissedCallsListToNewUi } from "@/lib/newui-transplant/adapters/mctb-missed-calls";
import type { MctbMissedCallsListData } from "@/lib/mctb/missed-calls-list-data";

export function NewUiMctbMissedCallsPage() {
  const [data, setData] = useState<MctbMissedCallsListData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/mctb/missed-calls?limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setData((j.data ?? j) as MctbMissedCallsListData))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !data) {
    return <p className="p-6 text-sm text-muted-foreground">Loading missed calls…</p>;
  }

  const missedCalls = mapMctbMissedCallsListToNewUi(data);
  const summary = data.summary;

  return (
    <TransplantMctbMissedCallsPage
      wired={{
        stats: {
          missed: String(summary.missedCount),
          recoveryTexts: String(summary.recoveryTextsCount),
          replies: String(summary.repliesCount),
          needsReply: String(summary.needsReplyCount),
        },
        missedCalls,
      }}
    />
  );
}
