import { formatSeriesDate } from "../mock-data";

export default function BookingTrendChart({
  series,
  rangeDays,
}: {
  series: Array<{ date: string; count: number }>;
  rangeDays: number;
}) {
  const max = Math.max(1, ...series.map((s) => s.count));
  const labelEvery = rangeDays === 30 ? 5 : 1;

  return (
    <div className="card card-pad">
      <div className="card-head">
        <div>
          <h3 className="card-title">Booking volume</h3>
          <p className="card-sub">
            Appointments booked per day · last {rangeDays} days
          </p>
        </div>
      </div>
      <div
        className="trend-chart"
        role="img"
        aria-label={`Bar chart of bookings per day for the last ${rangeDays} days`}
      >
        {series.map((s) => (
          <div
            key={s.date}
            className="trend-bar-wrap"
            data-tip={`${formatSeriesDate(s.date)} — ${s.count} booked`}
          >
            <div
              className="trend-bar"
              style={{ height: `${Math.max(2, (s.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="trend-x" aria-hidden="true">
        {series.map((s, i) => (
          <span key={s.date}>
            {i % labelEvery === 0 ? formatSeriesDate(s.date) : ""}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Bookings per day</caption>
        <thead>
          <tr><th>Date</th><th>Booked</th></tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.date}>
              <td>{formatSeriesDate(s.date)}</td>
              <td>{s.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
