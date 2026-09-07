import { RECALL_STATS } from "../mock-data";

export function RecallStatsRow() {
  return (
    <div className="tv-stats" role="list" aria-label="Recall metrics">
      {RECALL_STATS.map((s) => (
        <div className="tv-stat" role="listitem" key={s.label}>
          <div className="tv-stat-label">{s.label}</div>
          <div className="tv-stat-value">{s.value}</div>
          <div className="tv-stat-hint">{s.hint}</div>
        </div>
      ))}
    </div>
  );
}
