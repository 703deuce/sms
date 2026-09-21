export function MctbHeroMockup() {
  return (
    <div className="mctb-hero-mock" aria-hidden>
      <div className="mctb-hero-mock-chrome">
        <span className="mctb-hero-mock-dot" />
        <span className="mctb-hero-mock-dot" />
        <span className="mctb-hero-mock-dot" />
      </div>
      <div className="mctb-hero-mock-body">
        <div className="mctb-call-card">
          <p className="mctb-mock-label">Incoming call</p>
          <p className="mctb-mock-title">Lakeside Dental</p>
          <p className="mctb-mock-sub">Customer: (571) 555-0198</p>
          <span className="mctb-mock-badge warn">No answer</span>
        </div>
        <div className="mctb-flow-arrow">Call forwarded</div>
        <div className="mctb-ivr-card">
          <p className="mctb-mock-label">Transovo IVR</p>
          <div className="mctb-keypad">
            <span>Press</span>
            <strong>1</strong>
            <span>to continue by text</span>
          </div>
        </div>
        <div className="mctb-flow-arrow">↓</div>
        <span className="mctb-mock-badge ok">Customer opted in</span>
        <div className="mctb-sms-thread">
          <div className="mctb-bubble system">
            <p>
              You&apos;re subscribed to texts about your inquiry to Lakeside Dental. Reply STOP to
              opt out.
            </p>
            <span className="mctb-chip">Consent recorded</span>
          </div>
          <div className="mctb-bubble customer">
            <p>Hi, I was calling to see if you have anything available this week.</p>
          </div>
          <span className="mctb-chip">SMS sent</span>
        </div>
      </div>
    </div>
  );
}
