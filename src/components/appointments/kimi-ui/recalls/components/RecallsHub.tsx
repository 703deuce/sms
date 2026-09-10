"use client";

import { useState } from "react";
import { Bell, RefreshCcw, Plus, RotateCw, AlertTriangle } from "lucide-react";
import { RecallStatsRow } from "./RecallStatsRow";
import { RecallFeatureCard } from "./RecallFeatureCard";
import { RecallActivityList } from "./RecallActivityList";
import { RecallActivityModal } from "./RecallActivityModal";
import { RecallSavedViews } from "./RecallSavedViews";
import type { RecallActivity, RecallStat } from "../types";

export function RecallsHub({
  stats,
  activity,
  recallCampaignsMeta,
  noShowRecoveryMeta,
  loading = false,
  refreshError = false,
  onRefresh,
}: {
  stats: RecallStat[];
  activity: RecallActivity[];
  recallCampaignsMeta: string;
  noShowRecoveryMeta: string;
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
            Re-engage customers without a future appointment and recover missed visits.
            Recalls use your appointment history and booking types to reach out at the right time.
          </p>
        </div>
        <a className="tv-btn tv-btn-primary" href="/appointments/recall-campaigns">
          <Plus size={15} />
          New recall campaign
        </a>
      </header>

      <RecallStatsRow stats={stats} />

      <RecallSavedViews />

      <h2 className="tv-section-title">Recall tools</h2>
      <div className="tv-cards">
        <RecallFeatureCard
          icon={Bell}
          title="Recall campaigns"
          description="Target customers with no future appointment by last visit or appointment type. Send an SMS reminder inviting them to book again."
          meta={recallCampaignsMeta || "Set up recall campaigns"}
          cta="Open recall campaigns"
          href="/appointments/recall-campaigns"
        />
        <RecallFeatureCard
          icon={RefreshCcw}
          title="No-show recovery"
          description="Automatically follow up after missed appointments and invite customers to rebook. Follow-ups stop when the customer replies or rebooks."
          meta={noShowRecoveryMeta || "Configure no-show recovery"}
          cta="Open no-show recovery"
          href="/appointments/no-show-recovery"
        />
      </div>

      <div className="tv-section-head">
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
          {[0, 1, 2, 3].map((i) => (
            <div className="tv-skel-row" key={i}>
              <span className="tv-skel tv-skel-badge" />
              <span className="tv-skel tv-skel-line" style={{ width: "32%" }} />
              <span className="tv-skel tv-skel-line" style={{ width: "18%" }} />
            </div>
          ))}
        </div>
      ) : hasActivity ? (
        <div aria-busy={busy}>
          <RecallActivityList items={activity} onSelect={setSelected} />
        </div>
      ) : (
        <div className="tv-table-wrap tv-state-block">
          <p className="tv-state-title">No recall activity yet</p>
          <p className="tv-subtitle" style={{ margin: "6px auto 14px", maxWidth: "46ch" }}>
            When recall campaigns or no-show follow-ups are sent, they&apos;ll appear here so you can track
            outreach and rebookings in one place.
          </p>
          <a className="tv-btn tv-btn-primary" href="/appointments/recall-campaigns">
            <Plus size={15} />
            Create your first recall campaign
          </a>
        </div>
      )}

      {refreshError && hasActivity ? (
        <div style={{ marginTop: 12, opacity: 0.75 }}>
          <RecallActivityList items={activity} onSelect={setSelected} />
        </div>
      ) : null}

      {selected ? (
        <RecallActivityModal activity={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
