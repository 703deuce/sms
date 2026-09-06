"use client";

import { runtime } from "../mock-data";

type Runtime = typeof runtime;

type Props = {
  runtime: Runtime | null;
  loading: boolean;
  timezones: string[];
  onChange: (patch: Partial<Runtime>) => void;
};

export function QuietHoursCard({ runtime: rt, loading, timezones, onChange }: Props) {
  if (loading || !rt) {
    return (
      <section className="ref-card">
        <h2 className="ref-card-title">Quiet hours</h2>
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <div className="ref-skel" style={{ height: 38 }} />
          <div className="ref-skel" style={{ height: 38 }} />
          <div className="ref-skel" style={{ height: 38 }} />
        </div>
      </section>
    );
  }

  return (
    <section className="ref-card" aria-labelledby="quiet-title">
      <h2 className="ref-card-title" id="quiet-title">Quiet hours</h2>
      <p className="ref-card-sub">
        Automated messages are held during quiet hours and sent when the window ends.
        Urgent replies in an active conversation are never held.
      </p>

      <div style={{ marginTop: 16 }}>
        <div className="ref-field">
          <label className="ref-label" htmlFor="quietTimezone">Timezone</label>
          <select
            id="quietTimezone"
            name="quietTimezone"
            className="ref-select"
            value={rt.timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
            ))}
          </select>
          <p className="ref-hint">
            Quiet hours are evaluated in this timezone — not the recipient's device time.
          </p>
        </div>

        <div className="ref-row">
          <div className="ref-field">
            <label className="ref-label" htmlFor="quietStart">Quiet hours start</label>
            <input
              id="quietStart"
              name="quietStart"
              type="time"
              className="ref-input"
              value={rt.quietHoursStart}
              onChange={(e) => onChange({ quietHoursStart: e.target.value })}
            />
          </div>
          <div className="ref-field">
            <label className="ref-label" htmlFor="quietEnd">Quiet hours end</label>
            <input
              id="quietEnd"
              name="quietEnd"
              type="time"
              className="ref-input"
              value={rt.quietHoursEnd}
              onChange={(e) => onChange({ quietHoursEnd: e.target.value })}
            />
          </div>
        </div>

        <p className="ref-hint">
          Current window: messages scheduled between {rt.quietHoursStart} and {rt.quietHoursEnd}{" "}
          ({rt.timezone.replace(/_/g, " ")}) are delivered after {rt.quietHoursEnd}.
        </p>

        <hr className="ref-divider" />

        <p className="ref-section-label">Keyword handling</p>
        <div className="ref-field" style={{ marginBottom: 10 }}>
          <div className="ref-label" style={{ marginBottom: 2 }}>Opt-out keywords</div>
          <div className="ref-pills">
            {rt.optOutKeywords.map((k) => <span key={k} className="ref-pill">{k}</span>)}
          </div>
        </div>
        <div className="ref-field" style={{ marginBottom: 10 }}>
          <div className="ref-label" style={{ marginBottom: 2 }}>Opt-in keywords</div>
          <div className="ref-pills">
            {rt.optInKeywords.map((k) => <span key={k} className="ref-pill">{k}</span>)}
          </div>
        </div>
        <div className="ref-field" style={{ marginBottom: 0 }}>
          <div className="ref-label" style={{ marginBottom: 2 }}>Help keywords</div>
          <div className="ref-pills">
            {rt.helpKeywords.map((k) => <span key={k} className="ref-pill">{k}</span>)}
          </div>
        </div>
        <p className="ref-hint">
          Carrier-required keywords are enforced by the messaging runtime and can't be removed.
        </p>
      </div>
    </section>
  );
}
