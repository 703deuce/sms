import { useEffect, useState } from "react";
import type { WaitlistEntry } from "../mock-data";

export function WaitlistOfferModal({
  entry,
  busy,
  onClose,
  onSend,
}: {
  entry: WaitlistEntry;
  busy: boolean;
  onClose: () => void;
  onSend: (input: { serviceName: string; startsAt: string }) => void | Promise<void>;
}) {
  const [serviceName, setServiceName] = useState(entry.serviceName || "");
  const [startsAt, setStartsAt] = useState("");
  const [slots, setSlots] = useState<Array<{ startsAt: string }>>([]);

  useEffect(() => {
    if (!serviceName) return;
    fetch(
      `/api/appointments/availability?serviceName=${encodeURIComponent(serviceName)}&daysAhead=14`,
    )
      .then((r) => r.json())
      .then((json) => setSlots((json.data?.slots || []).slice(0, 24)))
      .catch(() => setSlots([]));
  }, [serviceName]);

  const expiresAt = startsAt
    ? new Date(new Date(startsAt).getTime() + 30 * 60_000).toLocaleString()
    : null;

  return (
    <div className="tv-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="tv-modal"
        role="dialog"
        aria-labelledby="waitlist-offer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="waitlist-offer-title" className="tv-modal-title">Send opening offer</h2>
        <p className="tv-modal-desc">
          Choose a real opening for {entry.phone || entry.email || "this customer"}.
          {entry.partySize && entry.partySize > 1
            ? ` Party size: ${entry.partySize}.`
            : ""}
        </p>

        <label className="tv-field">
          <span className="tv-fieldlabel">Service</span>
          <input
            className="tv-input"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
          />
        </label>

        <div className="tv-field">
          <span className="tv-fieldlabel">Available openings</span>
          {slots.length === 0 ? (
            <p className="tv-muted">No slots loaded. Pick a time manually below.</p>
          ) : (
            <div className="tv-slotgrid">
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  className={startsAt === slot.startsAt ? "tv-slot tv-slot--active" : "tv-slot"}
                  onClick={() => setStartsAt(slot.startsAt)}
                >
                  {new Date(slot.startsAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="tv-field">
          <span className="tv-fieldlabel">Or set time manually</span>
          <input
            type="datetime-local"
            className="tv-input"
            value={startsAt ? startsAt.slice(0, 16) : ""}
            onChange={(e) => {
              if (!e.target.value) return;
              setStartsAt(new Date(e.target.value).toISOString());
            }}
          />
        </label>

        {expiresAt ? (
          <p className="tv-muted">Offer expires: {expiresAt}</p>
        ) : null}

        <div className="tv-modal-actions">
          <button type="button" className="tv-btn tv-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="tv-btn tv-btn--primary"
            disabled={!serviceName || !startsAt || busy}
            onClick={() => void onSend({ serviceName, startsAt })}
          >
            {busy ? "Sending…" : "Send offer"}
          </button>
        </div>
      </div>
    </div>
  );
}
