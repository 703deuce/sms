"use client";

import { MctbPageContainer } from "@/components/mctb/shell/mctb-page-container";
import { LEAD_RECOVERY_SCENARIO_DEFS } from "@/lib/mctb/lead-recovery/scenarios";
import type {
  IntentPolicyShape,
  LeadRecoveryScenarioKey,
  LeadRecoveryWorkspaceConfig,
  PolicyHealthStatus,
} from "@/lib/mctb/lead-recovery/types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./ai-lead-recovery.css";

type HealthPayload = {
  overall: PolicyHealthStatus;
  scenarioHealth: Partial<Record<LeadRecoveryScenarioKey, PolicyHealthStatus>>;
  providers: { booking: PolicyHealthStatus; payments: PolicyHealthStatus; notifications: PolicyHealthStatus };
};

function statusLabel(s: PolicyHealthStatus | undefined): string {
  if (!s || s === "DISABLED") return "Off";
  if (s === "READY") return "Ready";
  if (s === "NEEDS_CONFIGURATION") return "Needs setup";
  if (s === "PROVIDER_BLOCKED") return "Provider blocked";
  if (s === "UPGRADE_REQUIRED") return "Premium";
  return s;
}

function statusClass(s: PolicyHealthStatus | undefined): string {
  if (s === "READY") return "lr-status--ready";
  if (s === "NEEDS_CONFIGURATION" || s === "PROVIDER_BLOCKED") return "lr-status--warn";
  if (s === "UPGRADE_REQUIRED") return "lr-status--upgrade";
  return "lr-status--neutral";
}

export function AiLeadRecoveryPage() {
  const [config, setConfig] = useState<LeadRecoveryWorkspaceConfig | null>(null);
  const [draft, setDraft] = useState<LeadRecoveryWorkspaceConfig | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [testMessage, setTestMessage] = useState("There's water pouring through my ceiling.");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/mctb/lead-recovery/config", { cache: "no-store" });
    const json = await res.json();
    const cfg = json.data?.config as LeadRecoveryWorkspaceConfig;
    setConfig(cfg);
    setDraft(cfg);
    setHealth(json.data?.health as HealthPayload);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(draft), [config, draft]);

  const enabledCount = useMemo(() => {
    if (!draft) return 0;
    return LEAD_RECOVERY_SCENARIO_DEFS.filter((d) => draft.enabledScenarios[d.key]).length;
  }, [draft]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/mctb/lead-recovery/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: draft.enabled,
        globalMode: draft.globalMode,
        enabledScenarios: draft.enabledScenarios,
        intentPolicies: draft.intentPolicies,
        fallbackPolicy: draft.fallbackPolicy,
        globalBehavior: draft.globalBehavior,
        paymentPolicy: draft.paymentPolicy,
        serviceAreaPolicy: draft.serviceAreaPolicy,
        bookingLinkId: draft.bookingLinkId,
        actionCapabilities: draft.actionCapabilities,
        handoffTriggers: draft.handoffTriggers,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Save failed");
      setSaving(false);
      return;
    }
    setConfig(json.data.config);
    setDraft(json.data.config);
    setHealth(json.data.health);
    setSavedAt(new Date().toLocaleTimeString());
    setSaving(false);
  };

  const toggleScenario = (key: LeadRecoveryScenarioKey, on: boolean) => {
    if (!draft) return;
    setDraft({
      ...draft,
      enabled: true,
      enabledScenarios: { ...draft.enabledScenarios, [key]: on },
    });
  };

  const updatePolicy = (intent: string, patch: Partial<IntentPolicyShape>) => {
    if (!draft) return;
    const prev = draft.intentPolicies[intent as keyof typeof draft.intentPolicies] || {
      enabled: true,
      collect: [],
      actions: [],
    };
    setDraft({
      ...draft,
      intentPolicies: {
        ...draft.intentPolicies,
        [intent]: { ...prev, ...patch },
      },
    });
  };

  const runTest = async () => {
    setTestLoading(true);
    const res = await fetch(
      `/api/mctb/lead-recovery/config?simulate=1&message=${encodeURIComponent(testMessage)}`,
    );
    const json = await res.json();
    setTestResult(json.data?.simulation as Record<string, unknown>);
    setTestLoading(false);
  };

  if (loading || !draft) {
    return (
      <MctbPageContainer title="AI Lead Recovery">
        <p className="lr-muted">Loading…</p>
      </MctbPageContainer>
    );
  }

  return (
    <MctbPageContainer title="AI Lead Recovery">
      <div className="lr-page">
        <header className="lr-header">
          <div className="lr-header-left">
            <Sparkles className="lr-header-icon" aria-hidden />
            <div>
              <h1 className="lr-title">AI Lead Recovery</h1>
              <p className="lr-subtitle">
                Choose what Transovo should understand, collect, answer, and do after a missed call.
              </p>
            </div>
          </div>
          <div className="lr-header-actions">
            <button type="button" className="lr-btn lr-btn--secondary" onClick={() => setTestOpen(true)}>
              Test AI
            </button>
            <button
              type="button"
              className="lr-btn lr-btn--primary"
              disabled={!dirty || saving}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </header>

        {draft.migratedFromAiBooking && (
          <div className="lr-banner lr-banner--info">
            Your previous AI Booking setup was moved here. Review booking policy below.
          </div>
        )}

        {error && <div className="lr-banner lr-banner--error">{error}</div>}

        <div className="lr-status-strip">
          <span>AI Lead Recovery <strong>{draft.enabled ? "Enabled" : "Disabled"}</strong></span>
          <span>Policies <strong>{enabledCount} active</strong></span>
          <span>
            Providers{" "}
            <strong className={statusClass(health?.providers.booking)}>
              {statusLabel(health?.providers.booking)}
            </strong>
          </span>
          <span>Last saved <strong>{savedAt || "—"}</strong></span>
        </div>

        <div className="lr-grid">
          <div className="lr-main">
            <section className="lr-section">
              <h2 className="lr-section-title">What should Transovo handle?</h2>
              <p className="lr-section-desc">Turn on only the situations you want AI Lead Recovery to manage.</p>
              <div className="lr-cap-grid">
                {LEAD_RECOVERY_SCENARIO_DEFS.map((def) => {
                  const on = Boolean(draft.enabledScenarios[def.key]);
                  const st = draft.scenarioHealth?.[def.key] || health?.scenarioHealth?.[def.key];
                  return (
                    <div key={def.key} className={`lr-cap-card ${on ? "lr-cap-card--on" : ""}`}>
                      <div>
                        <div className="lr-cap-title">{def.title}</div>
                        <div className="lr-cap-desc">{def.description}</div>
                        {on && <span className={`lr-status-chip ${statusClass(st)}`}>{statusLabel(st)}</span>}
                      </div>
                      <label className="lr-toggle">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => toggleScenario(def.key, e.target.checked)}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </section>

            {draft.enabledScenarios.booking && (
              <PolicyCard title="Booking" status={draft.scenarioHealth?.booking}>
                <p className="lr-panel-desc">When a caller wants to schedule.</p>
                <BookingModeEditor draft={draft} updatePolicy={updatePolicy} />
              </PolicyCard>
            )}

            {draft.enabledScenarios.emergencies && (
              <PolicyCard title="Emergencies" status={draft.scenarioHealth?.emergencies}>
                <p className="lr-panel-desc">Urgent situations — immediate alerts can send before all fields are collected.</p>
                <EmergencyEditor draft={draft} updatePolicy={updatePolicy} />
              </PolicyCard>
            )}

            {draft.enabledScenarios.take_message && (
              <PolicyCard title="Take a message" status={draft.scenarioHealth?.take_message}>
                <TakeMessageEditor draft={draft} updatePolicy={updatePolicy} />
              </PolicyCard>
            )}

            {draft.enabledScenarios.pricing && (
              <PolicyCard title="Pricing questions" status={draft.scenarioHealth?.pricing}>
                <PricingEditor draft={draft} updatePolicy={updatePolicy} />
              </PolicyCard>
            )}

            {draft.enabledScenarios.payments && (
              <PolicyCard title="Payments" status={draft.scenarioHealth?.payments}>
                <PaymentsEditor
                  draft={draft}
                  setDraft={setDraft}
                  updatePolicy={updatePolicy}
                />
              </PolicyCard>
            )}

            <section className="lr-card">
              <h3 className="lr-card-title">When Transovo is unsure</h3>
              <p className="lr-panel-desc">Ask one clarifying question, then notify your team.</p>
              <label className="lr-check">
                <input type="checkbox" checked={draft.handoffTriggers.uncertain} readOnly disabled />
                Human handoff when uncertain (locked safe default)
              </label>
            </section>
          </div>

          <aside className="lr-rail">
            <div className="lr-card">
              <h3 className="lr-card-title">Readiness</h3>
              <ul className="lr-readiness-list">
                <li><span>Intent Agent</span><CheckCircle2 size={16} className="lr-ok" /></li>
                <li><span>Policy Engine</span><CheckCircle2 size={16} className="lr-ok" /></li>
                <li>
                  <span>Booking</span>
                  <span className={statusClass(health?.providers.booking)}>{statusLabel(health?.providers.booking)}</span>
                </li>
                <li>
                  <span>Payments</span>
                  <span className={statusClass(health?.providers.payments)}>{statusLabel(health?.providers.payments)}</span>
                </li>
              </ul>
            </div>
            <div className="lr-card">
              <h3 className="lr-card-title">Connected services</h3>
              <Link href={MCTB_ROUTES.integrations} className="lr-link-row">
                Manage integrations <ChevronRight size={14} />
              </Link>
              <Link href={MCTB_ROUTES.payments} className="lr-link-row">
                Payments <ChevronRight size={14} />
              </Link>
            </div>
            <div className="lr-card lr-card--locked">
              <h3 className="lr-card-title">Safety rules</h3>
              <ul className="lr-safety">
                <li>Never invent pricing or availability</li>
                <li>Never send payment without authorized amount</li>
                <li>Never claim booking success before provider confirms</li>
                <li>Honor opt-out immediately</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {testOpen && (
        <div className="lr-drawer-backdrop" role="presentation" onClick={() => setTestOpen(false)}>
          <div className="lr-drawer" role="dialog" aria-label="Test AI Lead Recovery" onClick={(e) => e.stopPropagation()}>
            <div className="lr-drawer-head">
              <h2>Test AI Lead Recovery</h2>
              <button type="button" className="lr-icon-btn" onClick={() => setTestOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="lr-muted">See what Transovo would do — no live provider mutations.</p>
            <textarea
              className="lr-textarea"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={4}
            />
            <button type="button" className="lr-btn lr-btn--primary" onClick={() => void runTest()} disabled={testLoading}>
              {testLoading ? "Analyzing…" : "Analyze"}
            </button>
            {testResult && (
              <pre className="lr-test-result">{JSON.stringify(testResult, null, 2)}</pre>
            )}
          </div>
        </div>
      )}
    </MctbPageContainer>
  );
}

function PolicyCard({
  title,
  status,
  children,
}: {
  title: string;
  status?: PolicyHealthStatus;
  children: React.ReactNode;
}) {
  return (
    <section className="lr-card lr-policy-card">
      <div className="lr-policy-head">
        <h3 className="lr-card-title">{title}</h3>
        <span className={`lr-status-chip ${statusClass(status)}`}>{statusLabel(status)}</span>
      </div>
      {children}
    </section>
  );
}

function BookingModeEditor({
  draft,
  updatePolicy,
}: {
  draft: LeadRecoveryWorkspaceConfig;
  updatePolicy: (intent: string, patch: Partial<IntentPolicyShape>) => void;
}) {
  const pol = draft.intentPolicies.BOOKING_REQUEST;
  const mode = pol?.mode || (pol?.actions?.includes("AI_BOOK") ? "AI_BOOK" : "SEND_BOOKING_LINK");
  const setMode = (m: string) => {
    const actions =
      m === "AI_BOOK"
        ? ["AI_BOOK"]
        : m === "SEND_BOOKING_LINK"
          ? ["SEND_BOOKING_LINK", "CUSTOMER_MESSAGE"]
          : m === "NOTIFY_BUSINESS"
            ? ["SEND_EMAIL_SUMMARY", "CREATE_CALLBACK_REQUEST"]
            : m === "COLLECT_ONLY"
              ? ["CREATE_CALLBACK_REQUEST"]
              : ["NO_OP"];
    updatePolicy("BOOKING_REQUEST", { mode: m as IntentPolicyShape["mode"], actions, enabled: true });
  };
  return (
    <div className="lr-radio-group">
      {[
        ["SEND_BOOKING_LINK", "Send booking link"],
        ["AI_BOOK", "AI checks availability and books"],
        ["NOTIFY_BUSINESS", "Notify me and let me handle it"],
        ["COLLECT_ONLY", "Collect request only"],
        ["DO_NOTHING", "Do nothing"],
      ].map(([val, label]) => (
        <label key={val} className={`lr-radio-row ${mode === val ? "lr-radio-row--on" : ""}`}>
          <input type="radio" name="booking-mode" checked={mode === val} onChange={() => setMode(val)} />
          {label}
        </label>
      ))}
      {mode === "SEND_BOOKING_LINK" && (
        <p className="lr-hint">
          <Link href={MCTB_ROUTES.setupRecovery}>Manage booking links</Link> in Setup → Recovery.
        </p>
      )}
      {mode === "AI_BOOK" && (
        <p className="lr-hint">
          Calendar provider settings sync from{" "}
          <Link href={MCTB_ROUTES.setupRecovery}>Setup → Recovery</Link> (AI Booking section).
        </p>
      )}
    </div>
  );
}

function EmergencyEditor({
  draft,
  updatePolicy,
}: {
  draft: LeadRecoveryWorkspaceConfig;
  updatePolicy: (intent: string, patch: Partial<IntentPolicyShape>) => void;
}) {
  const pol = draft.intentPolicies.EMERGENCY_OR_URGENT || { actions: [], collect: [], enabled: true };
  const toggleAction = (action: string) => {
    const set = new Set(pol.actions || []);
    if (set.has(action as never)) set.delete(action as never);
    else set.add(action as never);
    updatePolicy("EMERGENCY_OR_URGENT", { actions: [...set], enabled: true });
  };
  return (
    <>
      <div className="lr-check-grid">
        {[
          ["SEND_OWNER_SMS", "Text owner immediately"],
          ["SEND_EMAIL_SUMMARY", "Email office"],
          ["ROUTE_TO_ON_CALL", "Route to on-call"],
          ["CREATE_CALLBACK_REQUEST", "Callback request"],
          ["SEND_BOOKING_LINK", "Send booking link"],
          ["AI_BOOK", "AI book emergency slot"],
        ].map(([a, label]) => (
          <label key={a} className="lr-check">
            <input type="checkbox" checked={pol.actions?.includes(a as never)} onChange={() => toggleAction(a)} />
            {label}
          </label>
        ))}
      </div>
      <p className="lr-hint">
        <AlertTriangle size={14} /> Immediate alerts send as soon as emergency intent is confirmed.
      </p>
    </>
  );
}

function TakeMessageEditor({
  draft,
  updatePolicy,
}: {
  draft: LeadRecoveryWorkspaceConfig;
  updatePolicy: (intent: string, patch: Partial<IntentPolicyShape>) => void;
}) {
  const pol = draft.intentPolicies.GENERAL_INQUIRY || { collect: [], actions: [], enabled: true };
  const toggleField = (field: string) => {
    const set = new Set(pol.collect || []);
    if (set.has(field as never)) set.delete(field as never);
    else set.add(field as never);
    updatePolicy("GENERAL_INQUIRY", { collect: [...set], enabled: true });
  };
  return (
    <div className="lr-check-grid">
      {["NAME", "REASON", "EMAIL", "ADDRESS", "CALLBACK_TIME"].map((f) => (
        <label key={f} className="lr-check">
          <input type="checkbox" checked={pol.collect?.includes(f as never)} onChange={() => toggleField(f)} />
          {f.replace(/_/g, " ")}
        </label>
      ))}
    </div>
  );
}

function PricingEditor({
  updatePolicy,
}: {
  draft: LeadRecoveryWorkspaceConfig;
  updatePolicy: (intent: string, patch: Partial<IntentPolicyShape>) => void;
}) {
  return (
    <div className="lr-radio-group">
      {[
        ["ESTIMATE_REQUIRED", "Tell them an estimate is required"],
        ["APPROVED_PRICING", "Answer from approved pricing"],
        ["COLLECT_AND_NOTIFY", "Collect details and notify me"],
        ["ALWAYS_HANDOFF", "Always escalate to a person"],
      ].map(([m, label]) => (
        <label key={m} className="lr-radio-row">
          <input
            type="radio"
            name="pricing-mode"
            onChange={() =>
              updatePolicy("PRICING_QUESTION", {
                mode: m as IntentPolicyShape["mode"],
                enabled: true,
                actions: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
              })
            }
          />
          {label}
        </label>
      ))}
    </div>
  );
}

function PaymentsEditor({
  draft,
  setDraft,
  updatePolicy,
}: {
  draft: LeadRecoveryWorkspaceConfig;
  setDraft: (c: LeadRecoveryWorkspaceConfig) => void;
  updatePolicy: (intent: string, patch: Partial<IntentPolicyShape>) => void;
}) {
  return (
    <>
      <label className="lr-check">
        <input
          type="checkbox"
          checked={draft.paymentPolicy.textToPayEnabled}
          onChange={(e) => {
            setDraft({
              ...draft,
              paymentPolicy: { ...draft.paymentPolicy, textToPayEnabled: e.target.checked },
            });
            if (e.target.checked) {
              updatePolicy("PAYMENT_REQUEST", {
                enabled: true,
                actions: ["SEND_TEXT_TO_PAY", "CUSTOMER_MESSAGE"],
              });
            }
          }}
        />
        Enable Text-to-Pay
      </label>
      <p className="lr-hint">Transovo never invents payment amounts.</p>
      <label className="lr-field">
        Amount source
        <select
          value={draft.paymentPolicy.amountAuthority || "known_balance"}
          onChange={(e) =>
            setDraft({
              ...draft,
              paymentPolicy: {
                ...draft.paymentPolicy,
                amountAuthority: e.target.value as "known_balance" | "configured_fixed_fee" | "operator_payment_request",
              },
            })
          }
        >
          <option value="known_balance">Known existing charge</option>
          <option value="configured_fixed_fee">Configured fixed fee</option>
          <option value="operator_payment_request">Operator-created payment request</option>
        </select>
      </label>
    </>
  );
}
