import { formatHour, formatNumber } from "../mock-data";

export default function PopularTimes({
  times,
}: {
  times: Array<{ hour: number; count: number }>;
}) {
  const max = Math.max(1, ...times.map((t) => t.count));
  const peak = times.reduce(
    (best, t) => (t.count > best.count ? t : best),
    times[0] ?? { hour: 0, count: 0 },
  );

  return (
    <div className="card card-pad">
      <div className="card-head">
        <div>
          <h3 className="card-title">Popular booking times</h3>
          <p className="card-sub">
            {peak.count > 0
              ? `Peak demand at ${formatHour(peak.hour)}`
              : "Hourly booking distribution"}
          </p>
        </div>
      </div>
      <div className="rank-list">
        {times.map((t) => (
          <div className="rank-row" key={t.hour}>
            <span className="rank-name">{formatHour(t.hour)}</span>
            <span className="rank-value">{formatNumber(t.count)}</span>
            <div className="rank-track">
              <div
                className="rank-fill alt"
                style={{ width: `${(t.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
