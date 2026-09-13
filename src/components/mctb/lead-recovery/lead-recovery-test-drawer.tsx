"use client";

import type { StructuredSimulationUi } from "@/lib/mctb/lead-recovery/simulation-ui";
import type { LeadRecoveryWorkspaceConfig } from "@/lib/mctb/lead-recovery/types";
import { X } from "lucide-react";
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  draft: LeadRecoveryWorkspaceConfig;
};

export function LeadRecoveryTestDrawer({ open, onClose, draft }: Props) {
  const [message, setMessage] = useState("There's water pouring through my ceiling.");
  const [customerType, setCustomerType] = useState<"NEW" | "EXISTING" | "UNKNOWN">("UNKNOWN");
  const [businessStatus, setBusinessStatus] = useState<"OPEN" | "CLOSED" | "AUTO">("AUTO");
  const [loading, setLoading] = useState(false);
  const [structured, setStructured] = useState<StructuredSimulationUi | null>(null);
  const [technical, setTechnical] = useState<unknown>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  if (!open) return null;

  const run = async () => {
    setLoading(true);
    const res = await fetch("/api/mctb/lead-recovery/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        context: { customerType, businessStatus },
        draftConfig: draft,
      }),
    });
    const json = await res.json();
    const sim = json.data?.simulation;
    setStructured(sim?.structured as StructuredSimulationUi);
    setTechnical(sim);
    setLoading(false);
  };

  return (
    <div className="lr-drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="lr-drawer lr-drawer--test"
        role="dialog"
        aria-labelledby="lr-test-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lr-drawer-head">
          <div>
            <h2 id="lr-test-title">Test AI Lead Recovery</h2>
            <p className="lr-muted lr-drawer-sub">
              See how Transovo would handle a customer message without contacting anyone.
            </p>
          </div>
          <button type="button" className="lr-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <label className="lr-field">
          Customer message
          <textarea
            className="lr-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
          />
        </label>

        <div className="lr-test-context">
          <label className="lr-field">
            Customer
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as typeof customerType)}
            >
              <option value="UNKNOWN">Unknown</option>
              <option value="NEW">New</option>
              <option value="EXISTING">Existing</option>
            </select>
          </label>
          <label className="lr-field">
            Business status
            <select
              value={businessStatus}
              onChange={(e) => setBusinessStatus(e.target.value as typeof businessStatus)}
            >
              <option value="AUTO">Auto</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>
        </div>

        <button type="button" className="lr-btn lr-btn--primary" onClick={() => void run()} disabled={loading}>
          {loading ? "Analyzing…" : "Analyze"}
        </button>

        {structured && (
          <div className="lr-sim-results">
            <section className="lr-sim-card">
              <h3>Detected</h3>
              <dl className="lr-sim-dl">
                <div><dt>Primary intent</dt><dd>{structured.detected.primaryIntent}</dd></div>
                <div>
                  <dt>Secondary intents</dt>
                  <dd>{structured.detected.secondaryIntents.join(", ") || "—"}</dd>
                </div>
                <div><dt>Urgency</dt><dd>{structured.detected.urgency}</dd></div>
                <div><dt>Confidence</dt><dd>{structured.detected.confidence}</dd></div>
              </dl>
            </section>

            <section className="lr-sim-card">
              <h3>Policy</h3>
              <dl className="lr-sim-dl">
                <div><dt>Matched policy</dt><dd>{structured.policy.matchedPolicy}</dd></div>
                <div><dt>Policy status</dt><dd>{structured.policy.status}</dd></div>
              </dl>
            </section>

            {structured.collect.length > 0 && (
              <section className="lr-sim-card">
                <h3>Collect</h3>
                <ul className="lr-sim-list">
                  {structured.collect.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </section>
            )}

            {structured.immediateActions.length > 0 && (
              <section className="lr-sim-card">
                <h3>Immediate action</h3>
                <ol className="lr-sim-list lr-sim-list--ol">
                  {structured.immediateActions.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </section>
            )}

            <section className="lr-sim-card">
              <h3>Action plan</h3>
              <ol className="lr-sim-list lr-sim-list--ol">
                {structured.executionSequence.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>

            <section className="lr-sim-card">
              <h3>Blocked</h3>
              {structured.blocked.length === 0 ? (
                <p className="lr-muted">None</p>
              ) : (
                <ul className="lr-sim-list">
                  {structured.blocked.map((b) => (
                    <li key={b.label}>
                      <strong>{b.label}</strong> — {b.reason}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {structured.paymentNote && (
              <section className="lr-sim-card lr-sim-card--warn">
                <p>{structured.paymentNote}</p>
              </section>
            )}

            <section className="lr-sim-card">
              <h3>Customer response</h3>
              <p className="lr-sim-quote">&ldquo;{structured.customerResponse}&rdquo;</p>
            </section>

            {structured.domainEvents.length > 0 && (
              <section className="lr-sim-card">
                <h3>Activity</h3>
                <ul className="lr-sim-list">
                  {structured.domainEvents.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </section>
            )}

            <button
              type="button"
              className="lr-btn lr-btn--secondary lr-sim-tech-toggle"
              onClick={() => setShowTechnical((v) => !v)}
            >
              {showTechnical ? "Hide" : "View"} technical details
            </button>
            {showTechnical && technical && (
              <pre className="lr-test-result">{JSON.stringify(technical, null, 2)}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
