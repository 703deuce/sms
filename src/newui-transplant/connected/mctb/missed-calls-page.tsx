"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TransplantMctbMissedCallsPage } from "@/newui-transplant/mirror/routes/mctb/missed-calls/page";
import { mapMctbMissedCallsListToNewUi } from "@/lib/newui-transplant/adapters/mctb-missed-calls";
import { buildMissedCallsListUrl } from "@/lib/newui-transplant/missed-calls-query";
import type { MctbMissedCallsListData } from "@/lib/mctb/missed-calls-list-data";
import { addMctbExclusion } from "@/lib/newui-transplant/api/mctb-setup-client";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";

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

export function NewUiMctbMissedCallsPage({
  initialData,
  initialQuery = DEFAULT_QUERY,
}: {
  initialData?: MctbMissedCallsListData;
  initialQuery?: ListQuery;
}) {
  const [data, setData] = useState<MctbMissedCallsListData | null>(initialData ?? null);
  const [query, setQuery] = useState<ListQuery>(initialQuery);
  const [loading, setLoading] = useState(!initialData);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exclusionError, setExclusionError] = useState<string | null>(null);
  const skipInitialFetch = useRef(Boolean(initialData));
  const { business } = useOpusWorkspaceData();
  const timeZone = business?.timezone;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const url = buildMissedCallsListUrl({ ...query, pageSize: 50 });
      const res = await fetch(url, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        throw new Error((j as { error?: string }).error || "Could not load missed calls");
      }
      setData((j.data ?? j) as MctbMissedCallsListData);
    } catch (err) {
      setData(null);
      setLoadError(err instanceof Error ? err.message : "Could not load missed calls");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="p-6 text-sm text-muted-foreground">Loading missed calls…</p>;
  }

  if (!data) {
    return (
      <div className="p-6 text-sm">
        <p className="text-destructive" role="alert">
          {loadError || "Could not load missed calls."}
        </p>
        <button
          type="button"
          className="mt-3 text-sm font-medium text-primary underline"
          onClick={() => void load()}
        >
          Retry
        </button>
      </div>
    );
  }

  const missedCalls = mapMctbMissedCallsListToNewUi(data, timeZone);
  const summary = data.summary;
  const pagination = data.pagination;

  return (
    <>
      {exclusionError ? (
        <p className="px-6 pt-4 text-sm text-destructive" role="alert">{exclusionError}</p>
      ) : null}
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
            setExclusionError(null);
            try {
              await addMctbExclusion({ phoneE164, label });
              await load();
            } catch (err) {
              setExclusionError(err instanceof Error ? err.message : "Could not add exclusion");
              throw err;
            }
          },
        },
      }}
    />
    </>
  );
}
