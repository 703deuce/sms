"use client";

import { useState } from "react";
import type { MessagingRuntimeView } from "../types";

type Runtime = MessagingRuntimeView;

type Props = {
  runtime: Runtime | null;
  loading: boolean;
  timezones: string[];
  onChange: (patch: Partial<Runtime>) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
};

export function AwayHoursCard({ runtime: rt, loading, timezones, onChange, onSubmit }: Props) {
  const [urlError, setUrlError] = useState("");

  if (loading || !rt) {
    return (
      <section className="ref-card">
        <h2 className="ref-card-title">Away message & business hours</h2>
        <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
          <div className="ref-skel" style={{ height: 44 }} />
          <div className="ref-skel" style={{ height: 88 }} />
          <div className="ref-skel" style={{ height: 38 }} />
        </div>
      </section>
    );
  }

  return (
    <section className="ref-card" aria-labelledby="away-title">
      <h2 className="ref-card-title" id="away-title">Away message & business hours</h2>
      <p className="ref-card-sub">
        Automatic reply when contacts text in outside business hours.
      </p>

      <form id="messaging-runtime-form" onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <div className="ref-switch-row">
          <div>
            <div className="ref-check-label">Enable away auto-reply</div>
            <div className="ref-check-sub">
              Sends once per conversation when an inbound SMS arrives while you're away.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={rt.awayEnabled}
            aria-label="Enable away auto-reply"
            className={`ref-switch${rt.awayEnabled ? " on" : ""}`}
            onClick={() => onChange({ awayEnabled: !rt.awayEnabled })}
          />
        </div>

        <input type="hidden" name="awayEnabled" value={rt.awayEnabled ? "on" : ""} />

        <label className="ref-check">
          <input
            type="checkbox"
            name="awayAlways"
            checked={rt.awayAlways}
            disabled={!rt.awayEnabled}
            onChange={(e) => onChange({ awayAlways: e.target.checked })}
          />
          <span>
            <span className="ref-check-label">Send away reply at all times</span>
            <span className="ref-check-sub" style={{ display: "block" }}>
              When off, the away reply only sends outside business hours.
            </span>
          </span>
        </label>

        <div className="ref-field">
          <label className="ref-label" htmlFor="awayMessage">Away message</label>
          <textarea
            id="awayMessage"
            name="awayMessage"
            className="ref-textarea"
            value={rt.awayMessage}
            disabled={!rt.awayEnabled}
            maxLength={320}
            onChange={(e) => onChange({ awayMessage: e.target.value })}
          />
          <div className="ref-char-count">{rt.awayMessage.length}/320</div>
        </div>

        <div className="ref-field">
          <label className="ref-label" htmlFor="reviewLinkUrl">Review link URL — Optional</label>
          <input
            id="reviewLinkUrl"
            name="reviewLinkUrl"
            type="url"
            className={`ref-input${urlError ? " ref-input-error" : ""}`}
            placeholder="https://…"
            defaultValue={rt.reviewLinkUrl}
            aria-invalid={!!urlError}
            aria-describedby={urlError ? "review-url-error" : undefined}
            onBlur={(e) => {
              const v = e.target.value.trim();
              setUrlError(
                v && !/^https?:\/\/.+\..+/.test(v)
                  ? "Enter a complete URL starting with https://"
                  : "",
              );
            }}
            onChange={() => setUrlError("")}
          />
          {urlError ? (
            <p className="ref-field-error" id="review-url-error" role="alert">{urlError}</p>
          ) : (
            <p className="ref-hint">
              Used by post-appointment review request workflows. Leave blank to disable review links.
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
