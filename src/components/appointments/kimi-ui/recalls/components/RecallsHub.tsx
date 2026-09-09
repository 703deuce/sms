"use client";

import { useState } from "react";
import Link from "next/link";
import { RotateCw, AlertTriangle, Settings2 } from "lucide-react";
import { RecallStatsRow } from "./RecallStatsRow";
import { RecallActivityList } from "./RecallActivityList";
import { RecallActivityModal } from "./RecallActivityModal";
import { RecallsDueList } from "./RecallsDueList";
import type { RecallActivity, RecallStat } from "../types";

export function RecallsHub({
  stats,
  activity,
  loading = false,
  refreshError = false,
  onRefresh,
}: {
  stats: RecallStat[];
  activity: RecallActivity[];
  recallCampaignsMeta?: string;
  noShowRecoveryMeta?: string;
  loading?: boolean;
  refreshError?: boolean;
  onRefresh: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<RecallActivity | null>(null);

  async function refresh() {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }

  const busy = loading || refreshing;
  const hasActivity = activity.length > 0;

  return (
    <div className="tv-page">
      <header className="tv-header">
        <div>
          <h1 className="tv-title">Recalls</h1>
          <p className="tv-subtitle">
            See which customers are due to return and help them rebook. Configure automatic outreach
            in Automations.
          </p>
        </div>
        <Link className="tv-btn" href="/appointments/automations/recall">
          <Settings2 size={15} />
          Recall automation
        </Link>
      </header>

      {stats.length > 0 ? <RecallStatsRow stats={stats} /> : null}

      <div className="tv-section-head">
        <h2 className="tv-section-title" style={{ margin: 0 }}>Customers due to return</h2>
      </div>
      <RecallsDueList />

      <div className="tv-section-head" style={{ marginTop: 24 }}>
        <h2 className="tv-section-title" style={{ margin: 0 }}>Recent recall activity</h2>
        <button
          type="button"
          className="tv-btn"
          onClick={refresh}
          disabled={busy}
          aria-label="Refresh recall activity"
        >
          <RotateCw size={14} className={busy ? "animate-spin" : undefined} />
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {refreshError ? (
        <div className="tv-table-wrap tv-state-block" role="alert">
          <p className="tv-state-icon" aria-hidden="true">
            <AlertTriangle size={20} style={{ color: "var(--tv-warning)" }} />
          </p>
          <p className="tv-state-title">Recall activity couldn&apos;t be refreshed</p>
          <p className="tv-subtitle" style={{ margin: "6px auto 14px", maxWidth: "46ch" }}>
            {hasActivity
              ? "The most recent activity is still shown below. Try refreshing again."
              : "Something went wrong while loading recall activity. Try again."}
          </p>
          <button type="button" className="tv-btn tv-btn-primary" onClick={refresh}>
            Retry
          </button>
        </div>
      ) : busy && !hasActivity ? (
        <div className="tv-table-wrap" aria-busy="true" aria-label="Loading recall activity">
          {[0, 1, 2].map((i) => (
            <div className="tv-skel-row" key={i}>
              <span className="tv-skel tv-skel-badge" />
              <span className="tv-skel tv-skel-line" style={{ width: "32%" }} />
            </div>
          ))}
        </div>
      ) : hasActivity ? (
        <div aria-busy={busy}>
          <RecallActivityList items={activity} onSelect={setSelected} />
        </div>
      ) : (
        <div className="tv-table-wrap tv-state-block">
          <p className="tv-state-title">No recall outreach yet</p>
          <p className="tv-subtitle" style={{ margin: "6px auto 0", maxWidth: "46ch" }}>
            When recall automations send reminders, activity appears here.
          </p>
        </div>
      )}

      {selected ? (
        <RecallActivityModal activity={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
