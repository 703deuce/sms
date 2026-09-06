import { formatNumber } from "../mock-data";

export default function PopularBookingTypes({
  types,
}: {
  types: Array<{ name: string; count: number }>;
}) {
  const max = Math.max(1, ...types.map((t) => t.count));
  return (
    <div className="card card-pad">
      <div className="card-head">
        <div>
          <h3 className="card-title">Popular booking types</h3>
          <p className="card-sub">Most-booked services in this period</p>
        </div>
      </div>
      <div className="rank-list">
        {types.map((t) => (
          <div className="rank-row" key={t.name}>
            <span className="rank-name" title={t.name}>{t.name}</span>
            <span className="rank-value">{formatNumber(t.count)}</span>
            <div className="rank-track">
              <div
                className="rank-fill"
                style={{ width: `${(t.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
