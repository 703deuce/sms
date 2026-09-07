"use client";

import type { RecallStat } from "../types";

export function RecallStatsRow({ stats }: { stats: RecallStat[] }) {
  if (stats.length === 0) {
    return (
      <div className="tv-stats" aria-busy="true" aria-label="Loading recall metrics">
        {[0, 1, 2, 3].map((i) => (
          <div className="tv-stat" key={i}>
            <div className="tv-skel tv-skel-line" style={{ width: "70%", height: 12 }} />
            <div className="tv-skel tv-skel-line" style={{ width: "40%", height: 24, marginTop: 8 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="tv-stats" role="list" aria-label="Recall metrics">
      {stats.map((s) => (
        <div className="tv-stat" role="listitem" key={s.label}>
          <div className="tv-stat-label">{s.label}</div>
          <div className="tv-stat-value">{s.value}</div>
          <div className="tv-stat-hint">{s.hint}</div>
        </div>
      ))}
    </div>
  );
}
