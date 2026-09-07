"use client";

import { useState } from "react";
import { Bell, RefreshCcw, Plus, RotateCw, AlertTriangle } from "lucide-react";
import { RecallStatsRow } from "./RecallStatsRow";
import { RecallFeatureCard } from "./RecallFeatureCard";
import { RecallActivityList } from "./RecallActivityList";
import { RecallActivityModal } from "./RecallActivityModal";
import { RECALL_ACTIVITY, type RecallActivity } from "../mock-data";

type LoadState = "normal" | "loading" | "error";

export function RecallsHub() {
  const [state, setState] = useState<LoadState>("normal");
  const [selected, setSelected] = useState<RecallActivity | null>(null);

  // Sandbox simulation: first refresh errors to demonstrate the error state,
  // second refresh succeeds.
  function refresh() {
    setState("loading");
    window.setTimeout(() => {
      setState((prev) => (prev === "loading" ? (window.__tvRecallRefreshedOnce ? "normal" : "error") : prev));
      if (!window.__tvRecallRefreshedOnce) {
        window.__tvRecallRefreshedOnce = true;
      }
    }, 700);
  }

  const hasActivity = RECALL_ACTIVITY.length > 0;

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

      <RecallStatsRow />

      <h2 className="tv-section-title">Recall tools</h2>
      <div className="tv-cards">
        <RecallFeatureCard
          icon={Bell}
          title="Recall campaigns"
          description="Target customers with no future appointment by last visit or appointment type. Send an SMS reminder inviting them to book again."
          meta="2 active campaigns · 128 eligible customers"
          cta="Open recall campaigns"
          href="/appointments/recall-campaigns"
        />
        <RecallFeatureCard
          icon={RefreshCcw}
          title="No-show recovery"
          description="Automatically follow up after missed appointments and invite customers to rebook. Follow-ups stop when the customer replies or rebooks."
          meta="Enabled · 11 follow-ups sent this month"
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
          disabled={state === "loading"}
          aria-label="Refresh recall activity"
        >
          <RotateCw size={14} className={state === "loading" ? "animate-spin" : undefined} />
          {state === "loading" ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {state === "error" ? (
        <div className="tv-table-wrap tv-state-block" role="alert">
          <p className="tv-state-icon" aria-hidden="true">
            <AlertTriangle size={20} style={{ color: "var(--tv-warning)" }} />
          </p>
          <p className="tv-state-title">Recall activity couldn’t be refreshed</p>
          <p className="tv-subtitle" style={{ margin: "6px auto 14px", maxWidth: "46ch" }}>
            The most recent activity is still shown below. Try refreshing again.
          </p>
          <button type="button" className="tv-btn tv-btn-primary" onClick={refresh}>
            Retry
          </button>
        </div>
      ) : state === "loading" && !hasActivity ? (
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
        <div aria-busy={state === "loading"}>
          <RecallActivityList items={RECALL_ACTIVITY} onSelect={setSelected} />
        </div>
      ) : (
        <div className="tv-table-wrap tv-state-block">
          <p className="tv-state-title">No recall activity yet</p>
          <p className="tv-subtitle" style={{ margin: "6px auto 14px", maxWidth: "46ch" }}>
            When recall campaigns or no-show follow-ups are sent, they’ll appear here so you can track
            outreach and rebookings in one place.
          </p>
          <a className="tv-btn tv-btn-primary" href="/appointments/recall-campaigns">
            <Plus size={15} />
            Create your first recall campaign
          </a>
        </div>
      )}

      {state === "error" && hasActivity ? (
        <div style={{ marginTop: 12, opacity: 0.75 }}>
          <RecallActivityList items={RECALL_ACTIVITY} onSelect={setSelected} />
        </div>
      ) : null}

      {selected ? (
        <RecallActivityModal activity={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}
