import { AlertTriangle, BarChart3, CalendarPlus } from "lucide-react";

export function MetricsSkeleton() {
  return (
    <div className="metric-grid" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <div className="card metric-card" key={i}>
          <div style={{ width: "100%" }}>
            <div className="sk" style={{ height: 10, width: 72, marginBottom: 10 }} />
            <div className="sk" style={{ height: 24, width: 52 }} />
          </div>
          <div className="sk" style={{ width: 34, height: 34, borderRadius: 9 }} />
        </div>
      ))}
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="an-cols" aria-hidden="true">
      <div className="card card-pad">
        <div className="sk" style={{ height: 12, width: 120, marginBottom: 6 }} />
        <div className="sk" style={{ height: 10, width: 200, marginBottom: 18 }} />
        <div className="sk" style={{ height: 160, width: "100%" }} />
      </div>
      <div className="card card-pad">
        <div className="sk" style={{ height: 12, width: 140, marginBottom: 6 }} />
        <div className="sk" style={{ height: 10, width: 170, marginBottom: 18 }} />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="sk" style={{ height: 22, width: "100%", marginBottom: 10 }} />
        ))}
      </div>
      <span className="sr-only">Loading analytics…</span>
    </div>
  );
}

export function FirstUseEmpty() {
  return (
    <div className="state-box">
      <div className="state-icon">
        <CalendarPlus aria-hidden="true" />
      </div>
      <h3 className="state-title">No booking data yet</h3>
      <p className="state-desc">
        Booking analytics appear here once customers book appointments through your
        booking page or your team creates them manually. Set up a booking type to
        start collecting data.
      </p>
      <div className="state-actions">
        <button type="button" className="btn btn-primary">
          Create booking type
        </button>
        <button type="button" className="btn">
          New appointment
        </button>
      </div>
    </div>
  );
}

export function NoResults({ rangeDays, onReset }: { rangeDays: number; onReset: () => void }) {
  return (
    <div className="state-box">
      <div className="state-icon">
        <BarChart3 aria-hidden="true" />
      </div>
      <h3 className="state-title">No bookings in the last {rangeDays} days</h3>
      <p className="state-desc">
        There were no appointments booked during this period. Try a wider date
        range to see earlier booking activity.
      </p>
      <div className="state-actions">
        <button type="button" className="btn" onClick={onReset}>
          View last 30 days
        </button>
      </div>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="state-box">
      <div className="state-icon danger">
        <AlertTriangle aria-hidden="true" />
      </div>
      <h3 className="state-title">Booking analytics couldn't be loaded</h3>
      <p className="state-desc">
        We couldn't retrieve your booking metrics. Your appointments and reminder
        schedules are unaffected. Try loading the data again.
      </p>
      <div className="state-actions">
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Retry
        </button>
      </div>
    </div>
  );
}

export function DegradedBanner() {
  return (
    <div className="degraded-banner" role="status">
      <AlertTriangle size={16} aria-hidden="true" />
      <div>
        <strong>Some metrics may be incomplete.</strong> Reminder delivery data is
        temporarily delayed, so reminder and engagement figures may lag behind
        booking totals shown here.
      </div>
    </div>
  );
}
