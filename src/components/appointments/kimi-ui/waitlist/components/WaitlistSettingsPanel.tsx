"use client";

type Props = {
  notifyOnOpening: boolean;
  autoFill: boolean;
  offerExpirationMinutes: number;
  saving: boolean;
  onNotifyChange: (value: boolean) => void;
  onAutoFillChange: (value: boolean) => void;
  onExpirationChange: (minutes: number) => void;
  onSave: () => void;
};

export function WaitlistSettingsPanel({
  notifyOnOpening,
  autoFill,
  offerExpirationMinutes,
  saving,
  onNotifyChange,
  onAutoFillChange,
  onExpirationChange,
  onSave,
}: Props) {
  return (
    <section className="tv-card" style={{ marginTop: 16 }}>
      <h2 className="tv-section-title">Opening notifications</h2>
      <p className="tv-page-desc">
        When a matching appointment opens, Transovo can send the next eligible customer an offer.
      </p>
      <label className="tv-toggle-row">
        <input type="checkbox" checked={notifyOnOpening} onChange={(e) => onNotifyChange(e.target.checked)} />
        Send an offer when a matching opening becomes available
      </label>
      <label className="tv-toggle-row">
        <input type="checkbox" checked={autoFill} onChange={(e) => onAutoFillChange(e.target.checked)} />
        Automatically offer canceled openings
      </label>
      <div className="tv-field-row">
        <label htmlFor="offer-expiration">Offer expiration</label>
        <select
          id="offer-expiration"
          value={offerExpirationMinutes}
          onChange={(e) => onExpirationChange(Number(e.target.value))}
        >
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>1 hour</option>
          <option value={120}>2 hours</option>
        </select>
      </div>
      <button type="button" className="tv-btn tv-btn-primary" onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>
    </section>
  );
}
