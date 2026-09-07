"use client";

type ConsentCopy = {
  optInDescription: string;
  consentText: string;
  termsVersion: string;
  capturedAt: string;
};

type Props = {
  consent: ConsentCopy;
  saving: boolean;
  dirty: boolean;
  onChange: (patch: Partial<ConsentCopy>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function ConsentCopyCard({ consent, saving, dirty, onChange, onSubmit }: Props) {
  return (
    <section className="ref-card" style={{ marginTop: 16 }} aria-labelledby="consent-title">
      <div className="ref-card-head">
        <div>
          <h2 className="ref-card-title" id="consent-title">SMS consent copy</h2>
          <p className="ref-card-sub">
            The opt-in wording customers see on your public booking page. The exact version shown is
            stored as evidence with every consent event — editing this text increments the version.
          </p>
        </div>
        <span className="ref-chip gray">v{consent.termsVersion}</span>
      </div>

      <form id="messaging-consent-form" onSubmit={onSubmit}>
        <div className="ref-field">
          <label className="ref-label" htmlFor="consentText">Consent checkbox text</label>
          <textarea
            id="consentText"
            name="consentText"
            className="ref-textarea"
            value={consent.consentText}
            maxLength={320}
            disabled={saving}
            onChange={(e) => onChange({ consentText: e.target.value })}
          />
          <div className="ref-char-count">{consent.consentText.length}/320</div>
          <p className="ref-hint">
            Rendered next to an unchecked checkbox on the booking page. Must name the message purpose
            (appointment texts), your business, and link Terms &amp; Privacy. Never pre-selected.
          </p>
        </div>

        <div className="ref-field">
          <label className="ref-label" htmlFor="optInDescription">Opt-in method description</label>
          <textarea
            id="optInDescription"
            name="optInDescription"
            className="ref-textarea"
            style={{ minHeight: 64 }}
            value={consent.optInDescription}
            maxLength={320}
            disabled={saving}
            onChange={(e) => onChange({ optInDescription: e.target.value })}
          />
          <p className="ref-hint">
            Describes how subscribers opt in — filed with your carrier registration and must match
            actual booking page behavior.
          </p>
        </div>

        <hr className="ref-divider" />

        <div className="ref-meta" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 14 }}>
          <div className="ref-meta-item">
            <div className="ref-meta-k">Active version</div>
            <div className="ref-meta-v">v{consent.termsVersion} — in use on booking page</div>
          </div>
          <div className="ref-meta-item">
            <div className="ref-meta-k">Current wording active since</div>
            <div className="ref-meta-v">{consent.capturedAt}</div>
          </div>
        </div>

        <p className="ref-hint" style={{ marginBottom: 14 }}>
          Historical consent records keep the version that was shown at capture time. Saving new wording
          only affects future opt-ins — past evidence is never rewritten.
        </p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="submit"
            className="ref-save-btn"
            disabled={saving || !dirty}
          >
            {saving ? "Saving…" : dirty ? "Save consent copy" : "No changes"}
          </button>
        </div>
      </form>
    </section>
  );
}
