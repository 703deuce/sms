"use client";

import { MctbPageContainer } from "@/components/mctb/shell/mctb-page-container";
import {
  workspaceUsesAiBookTarget,
  workspaceUsesBookingProvider,
  workspaceUsesTextToPay,
} from "@/lib/mctb/lead-recovery/capabilities";
import {
  MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI,
  MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI,
} from "@/lib/mctb/launch-flags";
import { defaultIntentPolicies } from "@/lib/mctb/lead-recovery/policy-defaults";
import { LEAD_RECOVERY_SCENARIO_DEFS } from "@/lib/mctb/lead-recovery/scenarios";
import type {
  IntentPolicyShape,
  LeadRecoveryScenarioKey,
  LeadRecoveryWorkspaceConfig,
  PolicyHealthStatus,
} from "@/lib/mctb/lead-recovery/types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { AlertTriangle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LeadRecoveryProviderPanel } from "@/components/mctb/lead-recovery/lead-recovery-provider-panel";
import { LeadRecoveryTestDrawer } from "@/components/mctb/lead-recovery/lead-recovery-test-drawer";
import "./ai-lead-recovery.css";

type HealthPayload = {
  overall: PolicyHealthStatus;
  scenarioHealth: Partial<Record<LeadRecoveryScenarioKey, PolicyHealthStatus>>;
  providers: {
    booking: PolicyHealthStatus;
    payments: PolicyHealthStatus;
    notifications: PolicyHealthStatus;
  };
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
  const [knowledge, setKnowledge] = useState<{ approvedCount: number; ready: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/mctb/lead-recovery/config", { cache: "no-store" });
    const json = await res.json();
    const cfg = json.data?.config as LeadRecoveryWorkspaceConfig;
    setConfig(cfg);
    setDraft(cfg);
    setHealth(json.data?.health as HealthPayload);
    setKnowledge(json.data?.knowledge as { approvedCount: number; ready: boolean });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(draft), [config, draft]);

  const launchScenarioDefs = useMemo(
    () =>
      LEAD_RECOVERY_SCENARIO_DEFS.filter((d) => {
        if (MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI && d.key === "payments") return false;
        return true;
      }),
    [],
  );

  const enabledCount = useMemo(() => {
    if (!draft) return 0;
    return launchScenarioDefs.filter((d) => draft.enabledScenarios[d.key]).length;
  }, [draft, launchScenarioDefs]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const enabledScenarios = { ...draft.enabledScenarios };
    if (MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI) {
      enabledScenarios.payments = false;
    }
    const intentPolicies = { ...draft.intentPolicies };
    if (MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI) {
      const booking = intentPolicies.BOOKING_REQUEST;
      if (booking?.mode === "AI_BOOK" || booking?.actions?.includes("AI_BOOK")) {
        intentPolicies.BOOKING_REQUEST = {
          ...booking,
          mode: "SEND_BOOKING_LINK",
          actions: ["SEND_BOOKING_LINK", "CUSTOMER_MESSAGE"],
          enabled: booking.enabled ?? true,
        };
      }
      const emergency = intentPolicies.EMERGENCY_OR_URGENT;
      if (emergency?.actions?.includes("AI_BOOK")) {
        intentPolicies.EMERGENCY_OR_URGENT = {
          ...emergency,
          actions: emergency.actions.filter((a) => a !== "AI_BOOK"),
        };
      }
    }
    const res = await fetch("/api/mctb/lead-recovery/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: draft.enabled,
        globalMode: draft.globalMode,
        enabledScenarios,
        intentPolicies,
        fallbackPolicy: draft.fallbackPolicy,
        globalBehavior: draft.globalBehavior,
        paymentPolicy: draft.paymentPolicy,
        serviceAreaPolicy: draft.serviceAreaPolicy,
        existingCustomerPolicy: draft.existingCustomerPolicy,
        faqPolicy: draft.faqPolicy,
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
    const enabledScenarios = { ...draft.enabledScenarios, [key]: on };
    let intentPolicies = draft.intentPolicies;
    if (key === "existing_customer" && on) {
      const defaults = defaultIntentPolicies("SEND_BOOKING_LINK");
      intentPolicies = {
        ...intentPolicies,
        EXISTING_CUSTOMER_ISSUE:
          intentPolicies.EXISTING_CUSTOMER_ISSUE ?? defaults.EXISTING_CUSTOMER_ISSUE,
        CANCEL_REQUEST: intentPolicies.CANCEL_REQUEST ?? defaults.CANCEL_REQUEST,
      };
    }
    setDraft({
      ...draft,
      enabled: true,
      enabledScenarios,
      intentPolicies,
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
                Turn on capabilities (booking links, emergencies, FAQs, and more). Intent detection stays separate
                from your saved handling policy for each enabled scenario.
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
            Your previous AI Booking settings were merged into Lead Recovery. Enable Booking only if you want scheduling as one capability.
          </div>
        )}

        {error && <div className="lr-banner lr-banner--error">{error}</div>}

        <div className="lr-status-strip">
          <span>AI Lead Recovery <strong>{draft.enabled ? "Enabled" : "Disabled"}</strong></span>
          <span>Policies <strong>{enabledCount} active</strong></span>
          <span>
            Status{" "}
            <strong className={statusClass(health?.overall)}>
              {statusLabel(health?.overall)}
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
                {launchScenarioDefs.map((def) => {
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
              <PolicyCard title="Booking" status={health?.scenarioHealth?.booking}>
                <p className="lr-panel-desc">When a caller wants to schedule.</p>
                <BookingModeEditor draft={draft} updatePolicy={updatePolicy} />
              </PolicyCard>
            )}

            {draft.enabledScenarios.emergencies && (
              <PolicyCard title="Emergencies" status={health?.scenarioHealth?.emergencies}>
                <p className="lr-panel-desc">Urgent situations — immediate alerts can send before all fields are collected.</p>
                <EmergencyEditor draft={draft} updatePolicy={updatePolicy} />
              </PolicyCard>
            )}

            {draft.enabledScenarios.take_message && (
              <PolicyCard title="Take a message" status={health?.scenarioHealth?.take_message}>
                <TakeMessageEditor draft={draft} updatePolicy={updatePolicy} />
              </PolicyCard>
            )}

            {draft.enabledScenarios.pricing && (
              <PolicyCard title="Pricing questions" status={health?.scenarioHealth?.pricing}>
                <PricingEditor draft={draft} updatePolicy={updatePolicy} />
              </PolicyCard>
            )}

            {draft.enabledScenarios.service_area && (
              <PolicyCard title="Service-area questions" status={health?.scenarioHealth?.service_area}>
                <ServiceAreaEditor draft={draft} setDraft={setDraft} />
              </PolicyCard>
            )}

            {draft.enabledScenarios.existing_customer && (
              <PolicyCard title="Existing-customer issues" status={health?.scenarioHealth?.existing_customer}>
                <ExistingCustomerEditor draft={draft} setDraft={setDraft} updatePolicy={updatePolicy} />
              </PolicyCard>
            )}

            {draft.enabledScenarios.general_faq && (
              <PolicyCard title="Questions & FAQs" status={health?.scenarioHealth?.general_faq}>
                <FaqEditor draft={draft} setDraft={setDraft} knowledge={knowledge} />
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
              <h3 className="lr-card-title">Policy health</h3>
              <ul className="lr-health-list">
                {launchScenarioDefs.filter((d) => draft.enabledScenarios[d.key]).map((def) => {
                  const st = health?.scenarioHealth?.[def.key];
                  return (
                    <li key={def.key}>
                      <span>{def.title}</span>
                      <span className={`lr-status-chip ${statusClass(st)}`}>{statusLabel(st)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <LeadRecoveryProviderPanel
              showBookingProvider={workspaceUsesBookingProvider(draft)}
              showBookingTargets={
                !MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI && workspaceUsesAiBookTarget(draft)
              }
              showPaymentsProvider={
                !MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI && workspaceUsesTextToPay(draft)
              }
              onBookingSaved={() => void load()}
            />
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

      <LeadRecoveryTestDrawer open={testOpen} onClose={() => setTestOpen(false)} draft={draft} />
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
  const rawMode =
    pol?.mode || (pol?.actions?.includes("AI_BOOK") ? "AI_BOOK" : "SEND_BOOKING_LINK");
  const mode =
    MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI && rawMode === "AI_BOOK" ? "SEND_BOOKING_LINK" : rawMode;
  const setMode = (m: string) => {
    if (MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI && m === "AI_BOOK") return;
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
        ...(MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI
          ? []
          : [["AI_BOOK", "AI checks availability and books"] as [string, string]]),
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
          <Link href={MCTB_ROUTES.setupLinks}>Manage booking links</Link> in Setup.
        </p>
      )}
      {!MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI && mode === "AI_BOOK" ? (
        <p className="lr-hint">
          Connect calendar in <Link href="/integrations?provider=microsoft">Integrations</Link> and choose
          the booking target in Connected services (right column).
        </p>
      ) : null}
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
          ...(MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI
            ? []
            : [["AI_BOOK", "AI book emergency slot"] as [string, string]]),
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

function ServiceAreaEditor({
  draft,
  setDraft,
}: {
  draft: LeadRecoveryWorkspaceConfig;
  setDraft: (c: LeadRecoveryWorkspaceConfig) => void;
}) {
  const pol = draft.serviceAreaPolicy;
  const patch = (p: Partial<LeadRecoveryWorkspaceConfig["serviceAreaPolicy"]>) =>
    setDraft({ ...draft, serviceAreaPolicy: { ...pol, ...p } });
  return (
    <>
      <p className="lr-panel-desc">Geographic answers use configured service area only — never guessed.</p>
      <label className="lr-field">
        Source
        <select value={pol.source || "workspace"} onChange={(e) => patch({ source: e.target.value as "workspace" | "manual" })}>
          <option value="workspace">Existing service area configuration</option>
          <option value="manual">Manual policy only</option>
        </select>
      </label>
      <p className="lr-hint">
        Service area: <strong>{pol.source === "workspace" ? "Configured" : "Needs configuration"}</strong>
        {" · "}
        <Link href="/company-brain">Manage service area</Link>
      </p>
      <label className="lr-field">
        In service area
        <select
          value={pol.inAreaAction || "continue"}
          onChange={(e) => patch({ inAreaAction: e.target.value as typeof pol.inAreaAction })}
        >
          <option value="continue">Continue qualification</option>
          <option value="booking_link">Send booking link</option>
          <option value="ai_book">AI Booking</option>
          <option value="callback">Create callback</option>
          <option value="notify">Notify business</option>
        </select>
      </label>
      <label className="lr-field">
        Outside service area
        <select
          value={pol.outOfAreaAction || "decline"}
          onChange={(e) => patch({ outOfAreaAction: e.target.value as typeof pol.outOfAreaAction })}
        >
          <option value="decline">Politely decline</option>
          <option value="notify">Notify business</option>
          <option value="handoff">Human handoff</option>
        </select>
      </label>
      <label className="lr-field">
        Unsure
        <select
          value={pol.uncertainAction || "clarify_zip"}
          onChange={(e) => patch({ uncertainAction: e.target.value as typeof pol.uncertainAction })}
        >
          <option value="clarify_zip">Ask ZIP/city</option>
          <option value="handoff">Human handoff</option>
          <option value="notify">Notify business</option>
        </select>
      </label>
    </>
  );
}

function ExistingCustomerEditor({
  draft,
  setDraft,
  updatePolicy,
}: {
  draft: LeadRecoveryWorkspaceConfig;
  setDraft: (c: LeadRecoveryWorkspaceConfig) => void;
  updatePolicy: (intent: string, patch: Partial<IntentPolicyShape>) => void;
}) {
  const ec = draft.existingCustomerPolicy;
  const toggleAction = (action: string) => {
    const set = new Set(ec.actions);
    if (set.has(action as never)) set.delete(action as never);
    else set.add(action as never);
    const actions = [...set];
    setDraft({ ...draft, existingCustomerPolicy: { ...ec, actions } });
    updatePolicy("EXISTING_CUSTOMER_ISSUE", { enabled: true, actions, collect: ["ISSUE_DESCRIPTION"] });
  };
  return (
    <>
      <p className="lr-panel-desc">
        Choose how Transovo handles customers with an existing job, appointment, or prior visit.
        Cancellation requests create a team follow-up — Transovo does not cancel appointments or
        jobs automatically by text.
      </p>
      <label className="lr-check">
        <input
          type="checkbox"
          checked={ec.treatDifferently}
          onChange={(e) =>
            setDraft({
              ...draft,
              existingCustomerPolicy: { ...ec, treatDifferently: e.target.checked },
            })
          }
        />
        Treat existing customers differently from new leads
      </label>
      <div className="lr-check-grid">
        {[
          ["CREATE_CALLBACK_REQUEST", "Create callback request"],
          ["SEND_EMAIL_SUMMARY", "Notify service manager"],
          ["ROUTE_TO_TEAM", "Route to team"],
          ["ESCALATE_HUMAN", "Human handoff"],
        ].map(([a, label]) => (
          <label key={a} className="lr-check">
            <input type="checkbox" checked={ec.actions.includes(a as never)} onChange={() => toggleAction(a)} />
            {label}
          </label>
        ))}
      </div>
      {ec.actions.includes("ROUTE_TO_TEAM") && (
        <label className="lr-field">
          Recipient
          <select
            value={ec.notifyRecipientId || ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                existingCustomerPolicy: { ...ec, notifyRecipientId: e.target.value || null },
              })
            }
          >
            <option value="">Service Manager</option>
            <option value="on_call">On-call</option>
            <option value="owner">Owner</option>
          </select>
        </label>
      )}
    </>
  );
}

const FAQ_TOPICS: Array<{ key: LeadRecoveryWorkspaceConfig["answerCapabilities"][number]; label: string }> = [
  { key: "HOURS", label: "Business hours" },
  { key: "SERVICES", label: "Services offered" },
  { key: "LOCATIONS", label: "Business locations" },
  { key: "SERVICE_AREA", label: "Service area" },
  { key: "PRICING", label: "Approved pricing" },
  { key: "FAQ", label: "General FAQs" },
];

function FaqEditor({
  draft,
  setDraft,
  knowledge,
}: {
  draft: LeadRecoveryWorkspaceConfig;
  setDraft: (c: LeadRecoveryWorkspaceConfig) => void;
  knowledge: { approvedCount: number; ready: boolean } | null;
}) {
  const fq = draft.faqPolicy;
  const topics = new Set(draft.answerCapabilities);
  const toggleTopic = (key: LeadRecoveryWorkspaceConfig["answerCapabilities"][number]) => {
    const next = new Set(topics);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setDraft({
      ...draft,
      answerCapabilities: [...next],
      faqPolicy: { ...fq, topics: [...next] },
    });
  };
  return (
    <>
      <p className="lr-panel-desc">AI may answer only from approved business knowledge.</p>
      <div className="lr-check-grid">
        {FAQ_TOPICS.map(({ key, label }) => (
          <label key={key} className="lr-check">
            <input type="checkbox" checked={topics.has(key)} onChange={() => toggleTopic(key)} />
            {label}
          </label>
        ))}
      </div>
      <p className="lr-hint">
        Knowledge source: Approved business knowledge ·{" "}
        {knowledge?.ready
          ? `Ready · ${knowledge.approvedCount} approved answers`
          : "Needs setup"}
        {" · "}
        <Link href="/company-brain">Manage knowledge</Link>
      </p>
      <label className="lr-field">
        If no supported answer
        <select
          value={fq.fallback}
          onChange={(e) =>
            setDraft({
              ...draft,
              faqPolicy: { ...fq, fallback: e.target.value as typeof fq.fallback },
            })
          }
        >
          <option value="clarify">Ask clarification</option>
          <option value="notify">Notify business</option>
          <option value="handoff">Human handoff</option>
        </select>
      </label>
    </>
  );
}
