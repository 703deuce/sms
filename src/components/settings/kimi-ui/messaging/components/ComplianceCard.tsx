"use client";

import type { MessagingRegistrationView } from "../types";

type Props = {
  registration: MessagingRegistrationView;
  saving: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function ComplianceCard({ registration: reg, saving, onSubmit }: Props) {
  return (
    <section className="ref-card" style={{ marginTop: 16 }} aria-labelledby="help-stop-title">
      <div className="ref-card-head">
        <div>
          <h2 className="ref-card-title" id="help-stop-title">STOP & HELP responses</h2>
          <p className="ref-card-sub">
            Automatic replies sent when a contact texts STOP or HELP. These messages are part of your
            carrier registration — keep business name and contact details accurate.
          </p>
        </div>
      </div>

      <form id="messaging-help-stop-form" onSubmit={onSubmit}>
        <div className="ref-field">
          <label className="ref-label" htmlFor="stopResponse">STOP response</label>
          <textarea
            id="stopResponse"
            name="stopResponse"
            className="ref-textarea"
            defaultValue={reg.stopMessage}
            maxLength={320}
            disabled={saving}
          />
          <p className="ref-hint">
            Sent immediately when a contact opts out. Future messages to that contact are suppressed
            at send time — including already-scheduled reminders and workflow steps.
          </p>
        </div>

        <div className="ref-field" style={{ marginBottom: 0 }}>
          <label className="ref-label" htmlFor="helpResponse">HELP response</label>
          <textarea
            id="helpResponse"
            name="helpResponse"
            className="ref-textarea"
            defaultValue={reg.helpMessage}
            maxLength={320}
            disabled={saving}
          />
          <p className="ref-hint">
            Must include a way to reach your business (phone or email) and “Msg&amp;data rates may apply.”
          </p>
        </div>
      </form>
    </section>
  );
}
