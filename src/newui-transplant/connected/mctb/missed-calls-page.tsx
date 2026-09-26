"use client";

import { useCallback, useEffect, useState } from "react";
import { TransplantMctbMissedCallsPage } from "@/newui-transplant/mirror/routes/mctb/missed-calls/page";
import { mapMctbMissedCallsListToNewUi } from "@/lib/newui-transplant/adapters/mctb-missed-calls";
import { buildMissedCallsListUrl } from "@/lib/newui-transplant/missed-calls-query";
import type { MctbMissedCallsListData } from "@/lib/mctb/missed-calls-list-data";
import { addMctbExclusion } from "@/lib/newui-transplant/api/mctb-setup-client";

type ListQuery = {
  q: string;
  recovery: string;
  date: string;
  trigger: string;
  sort: string;
  page: number;
};

const DEFAULT_QUERY: ListQuery = {
  q: "",
  recovery: "All",
  date: "Last 7 days",
  trigger: "All",
  sort: "Newest first",
  page: 1,
};

export function NewUiMctbMissedCallsPage() {
  const [data, setData] = useState<MctbMissedCallsListData | null>(null);
  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = buildMissedCallsListUrl({ ...query, pageSize: 50 });
      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json();
      setData((j.data ?? j) as MctbMissedCallsListData);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="p-6 text-sm text-muted-foreground">Loading missed calls…</p>;
  }

  if (!data) {
    return <p className="p-6 text-sm text-muted-foreground">Could not load missed calls.</p>;
  }

  const missedCalls = mapMctbMissedCallsListToNewUi(data);
  const summary = data.summary;
  const pagination = data.pagination;

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
        listWiring: {
          query: query.q,
          recovery: query.recovery,
          date: query.date,
          trigger: query.trigger,
          sort: query.sort,
          page: query.page,
          pageCount: pagination?.totalPages ?? 1,
          total: pagination?.total ?? missedCalls.length,
          loading,
          onQueryChange: (q) => setQuery((prev) => ({ ...prev, q, page: 1 })),
          onRecoveryChange: (recovery) => setQuery((prev) => ({ ...prev, recovery, page: 1 })),
          onDateChange: (date) => setQuery((prev) => ({ ...prev, date, page: 1 })),
          onTriggerChange: (trigger) => setQuery((prev) => ({ ...prev, trigger, page: 1 })),
          onSortChange: (sort) => setQuery((prev) => ({ ...prev, sort, page: 1 })),
          onPageChange: (page) => setQuery((prev) => ({ ...prev, page })),
          onAddExclusion: async (phoneE164, label) => {
            await addMctbExclusion({ phoneE164, label });
            await load();
          },
        },
      }}
    />
  );
}
