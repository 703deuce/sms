"use client";

import { MctbSetupShell } from "@/components/mctb/setup/mctb-setup-shell";
import "./mctb-setup-notifications.css";
import { RESPONSE_MODE_LABELS } from "@/lib/mctb/handoff/defaults";
import { MCTB_EMERGENCY_ACTIONS, MCTB_RESPONSE_MODES } from "@/lib/mctb/handoff/types";
import type {
  MctbHandoffConfigDto,
  MctbHandoffEventType,
  MctbLeadFieldConfig,
  MctbNotificationRecipientDto,
  MctbResponseMode,
} from "@/lib/mctb/handoff/types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  alertsActiveLabel,
  enabledRecipientCount,
  HANDOFF_EVENT_LABELS,
  handoffFlowSteps,
  handoffModeLabel,
  notificationsSnapshotsEqual,
  primaryEmailDestination,
  primarySmsDestination,
  ROUTING_EVENT_ROWS,
  routingRow,
  type NotificationsSnapshot,
} from "@/lib/mctb/setup-notifications-model";
import {
  AlertTriangle,
  Bell,
  Bot,
  Check,
  ClipboardList,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

const MODE_ICONS: Record<MctbResponseMode, typeof Bell> = {
  notify_only: Bell,
  guided_collection: ClipboardList,
  ai_conversation: Bot,
  immediate_handoff: UserCheck,
};

const TEST_PREVIEW = {
  normal:
    "New missed-call lead\n\nAnthony Johnson\n(571) 555-1234\n\nWater heater estimate\nWoodbridge, VA\nCallback after 4 PM",
  urgent:
    "URGENT — callback requested\n\nSarah Wilson\n(703) 555-1234\n\nCustomer says water is coming through the ceiling.\nUrgency: High",
  email:
    "Subject: New missed-call lead\nCaller, phone, need, location, callback preference, and conversation link.",
};

export function MctbSetupNotificationsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<MctbHandoffConfigDto | null>(null);
  const [recipients, setRecipients] = useState<MctbNotificationRecipientDto[]>([]);
  const [baseline, setBaseline] = useState<NotificationsSnapshot | null>(null);
  const [previewTab, setPreviewTab] = useState<"normal" | "urgent" | "email">("normal");
  const [testBusy, setTestBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/handoff", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load notification settings");
      setConfig(json.data.config);
      setRecipients(json.data.recipients || []);
      setBaseline({ config: json.data.config, recipients: json.data.recipients || [] });
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentSnapshot = useMemo(
    () => (config ? { config, recipients } : null),
    [config, recipients],
  );
  const dirty =
    baseline && currentSnapshot ? !notificationsSnapshotsEqual(baseline, currentSnapshot) : false;

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/mctb/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config, recipients }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setConfig(json.data.config);
      setRecipients(json.data.recipients);
      setBaseline({ config: json.data.config, recipients: json.data.recipients });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTestBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/handoff", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "test_notification" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test failed");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTestBusy(false);
    }
  }

  function updateField(id: string, requirement: MctbLeadFieldConfig["requirement"]) {
    if (!config) return;
    setConfig({
      ...config,
      fieldSchema: config.fieldSchema.map((f) => (f.id === id ? { ...f, requirement } : f)),
    });
    setSaved(false);
  }

  function updateRoutingChannel(
    event: MctbHandoffEventType,
    channel: "sms" | "email" | "in_app",
    on: boolean,
  ) {
    if (!config) return;
    const row = routingRow(config, event);
    const nextMatrix = { ...config.routingMatrix };
    nextMatrix[event] = {
      ...row,
      channels: { ...row.channels, [channel]: on },
      recipientIds: row.recipientIds || [],
    };
    setConfig({ ...config, routingMatrix: nextMatrix });
    setSaved(false);
  }

  const shellProps = {
    title: "Setup",
    description:
      "Configure missed-call recovery, forwarding, consent, voicemail, and operational controls.",
  };

  const headerAction = (
    <div className="mctb-notif-header-actions">
      {saved && !saving && !dirty ? (
        <span className="mctb-notif-save-meta">
          <Check className="h-4 w-4" aria-hidden />
          Saved
        </span>
      ) : null}
      <button
        type="button"
        className="mctb-setup-btn mctb-setup-btn--primary"
        style={{ minWidth: "7.5rem", height: "2.375rem" }}
        disabled={saving || !dirty || !config}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );

  if (loading) {
    return (
      <MctbSetupShell {...shellProps}>
        <div className="mctb-notif-page">
          <div className="mctb-setup-skel h-20 mb-3" />
          <div className="mctb-setup-skel h-96" />
        </div>
      </MctbSetupShell>
    );
  }

  if (!config) {
    return (
      <MctbSetupShell {...shellProps}>
        <div className="mctb-notif-page p-6">
          <p className="text-[13px] text-[#9b2c2c]" role="alert">
            {error || "Could not load notification settings."}
          </p>
          <button type="button" className="mctb-setup-btn mctb-setup-btn--primary mt-3" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </MctbSetupShell>
    );
  }

  const flow = handoffFlowSteps(config.responseMode);

  return (
    <MctbSetupShell {...shellProps}>
      <div className="mctb-notif-page">
        <header className="mctb-notif-section-header">
          <div className="mctb-notif-section-header__left">
            <div className="mctb-notif-section-header__icon" aria-hidden>
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.85} />
            </div>
            <div>
              <h2 className="mctb-notif-section-header__title">Notifications</h2>
              <p className="mctb-notif-section-header__desc">
                Choose when your team is alerted and where recovery conversations are handed off.
              </p>
            </div>
          </div>
          {headerAction}
        </header>

        {error ? (
          <div
            className="mb-3 rounded-lg border border-[#f0d0d0] bg-[#fff5f5] px-4 py-3 text-[13px] text-[#9b2c2c]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="mctb-notif-status-strip" aria-label="Notification summary">
          <div className="mctb-notif-status-strip__cell">
            <div className="mctb-notif-status-strip__label">Alerts</div>
            <div className="mctb-notif-status-strip__value">{alertsActiveLabel(recipients)}</div>
          </div>
          <div className="mctb-notif-status-strip__cell">
            <div className="mctb-notif-status-strip__label">Primary email</div>
            <div className="mctb-notif-status-strip__value">{primaryEmailDestination(recipients)}</div>
          </div>
          <div className="mctb-notif-status-strip__cell">
            <div className="mctb-notif-status-strip__label">SMS alerts</div>
            <div className="mctb-notif-status-strip__value">{primarySmsDestination(recipients)}</div>
          </div>
          <div className="mctb-notif-status-strip__cell">
            <div className="mctb-notif-status-strip__label">Handoff</div>
            <div className="mctb-notif-status-strip__value">{handoffModeLabel(config.responseMode)}</div>
          </div>
        </div>

        <div className="mctb-notif-grid">
          <div className="mctb-notif-main">
            <section className="mctb-notif-module" aria-labelledby="handoff-heading">
              <h3 id="handoff-heading" className="mctb-notif-module__title">Conversation handoff</h3>
              <p className="mctb-notif-module__sub">
                Choose what happens when a missed caller responds to recovery texting.
              </p>
              <div role="radiogroup" aria-label="Response mode">
                {MCTB_RESPONSE_MODES.map((mode) => {
                  const meta = RESPONSE_MODE_LABELS[mode];
                  const Icon = MODE_ICONS[mode];
                  return (
                    <button
                      key={mode}
                      type="button"
                      role="radio"
                      aria-checked={config.responseMode === mode}
                      className={`mctb-notif-choice${
                        config.responseMode === mode ? " mctb-notif-choice--selected" : ""
                      }`}
                      onClick={() => {
                        setConfig({ ...config, responseMode: mode });
                        setSaved(false);
                      }}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-[#626872]" aria-hidden />
                        <span>
                          <p className="mctb-notif-choice__title">{meta.title}</p>
                          <p className="mctb-notif-choice__sub">{meta.subtitle}</p>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 block text-[12px] font-medium text-[#626872]">
                Appointment booking in thread
                <select
                  className="mctb-notif-field mt-1"
                  value={config.bookingBehavior}
                  onChange={(e) => {
                    setConfig({
                      ...config,
                      bookingBehavior: e.target.value as MctbHandoffConfigDto["bookingBehavior"],
                    });
                    setSaved(false);
                  }}
                >
                  <option value="off">Off</option>
                  <option value="on_request">When customer asks</option>
                  <option value="selected_services">Selected services only</option>
                  <option value="ai_when_fit">AI when appropriate</option>
                </select>
              </label>
            </section>

            {config.responseMode === "guided_collection" ? (
              <section className="mctb-notif-module">
                <h3 className="mctb-notif-module__title">Information to collect</h3>
                <p className="mctb-notif-module__sub">
                  Off / optional / required before normal handoff notifications send.
                </p>
                <ul className="m-0 list-none p-0">
                  {config.fieldSchema
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((field) => (
                      <li
                        key={field.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[#eef0f2] last:border-0"
                      >
                        <span className="text-[13px] font-medium">{field.label}</span>
                        <select
                          className="mctb-notif-field max-w-[9rem]"
                          value={field.requirement}
                          onChange={(e) =>
                            updateField(field.id, e.target.value as MctbLeadFieldConfig["requirement"])
                          }
                          aria-label={`${field.label} requirement`}
                        >
                          <option value="off">Off</option>
                          <option value="optional">Optional</option>
                          <option value="required">Required</option>
                        </select>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}

            <section className="mctb-notif-module">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-[#a67c1a] mt-0.5" aria-hidden />
                <div>
                  <h3 className="mctb-notif-module__title m-0">Emergency handling</h3>
                  <p className="mctb-notif-module__sub mb-0">
                    High-consequence urgency — independent from response mode.
                  </p>
                </div>
              </div>
              <div className="mctb-notif-toggle-row">
                <span>Emergency detection</span>
                <ToggleSwitch
                  checked={config.emergencyDetectionEnabled}
                  label="Emergency detection"
                  onChange={(on) => {
                    setConfig({ ...config, emergencyDetectionEnabled: on });
                    setSaved(false);
                  }}
                />
              </div>
              {config.emergencyDetectionEnabled ? (
                <div className="mt-3 space-y-3">
                  <label className="block text-[12px] font-medium text-[#626872]">
                    Urgency criteria
                    <textarea
                      className="mt-1 w-full min-h-[4.5rem] rounded-md border border-[#dee2e6] px-3 py-2 text-[13px]"
                      rows={3}
                      placeholder="e.g. active flooding, burst pipe, no heat"
                      value={config.emergencyCriteria || ""}
                      onChange={(e) => {
                        setConfig({ ...config, emergencyCriteria: e.target.value || null });
                        setSaved(false);
                      }}
                    />
                  </label>
                  <label className="block text-[12px] font-medium text-[#626872]">
                    When urgency is detected
                    <select
                      className="mctb-notif-field mt-1"
                      value={config.emergencyAction}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          emergencyAction: e.target.value as MctbHandoffConfigDto["emergencyAction"],
                        });
                        setSaved(false);
                      }}
                    >
                      {MCTB_EMERGENCY_ACTIONS.map((a) => (
                        <option key={a} value={a}>
                          {a.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[12px] font-medium text-[#626872]">
                    If urgency is uncertain
                    <select
                      className="mctb-notif-field mt-1"
                      value={config.emergencyUncertainBehavior}
                      onChange={(e) => {
                        setConfig({
                          ...config,
                          emergencyUncertainBehavior: e.target
                            .value as MctbHandoffConfigDto["emergencyUncertainBehavior"],
                        });
                        setSaved(false);
                      }}
                    >
                      <option value="treat_normal">Treat as normal</option>
                      <option value="clarify">Ask clarifying question</option>
                      <option value="handoff_human">Hand off to human</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </section>

            <section className="mctb-notif-module">
              <h3 className="mctb-notif-module__title">Team recipients</h3>
              <p className="mctb-notif-module__sub">
                Operational alert destinations for leads, callbacks, and emergencies. Internal only —
                does not change recovery texts to callers.
              </p>
              {recipients.map((r, index) => (
                <div key={r.id || `new-${index}`} className="mctb-notif-recipient">
                  <div className="mctb-notif-toggle-row mb-2">
                    <span className="font-medium">{r.name || `Recipient ${index + 1}`}</span>
                    <ToggleSwitch
                      checked={r.enabled}
                      label={`Enable ${r.name || "recipient"}`}
                      onChange={(on) => {
                        const next = [...recipients];
                        next[index] = { ...r, enabled: on };
                        setRecipients(next);
                        setSaved(false);
                      }}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="mctb-notif-field"
                      placeholder="Name"
                      value={r.name}
                      onChange={(e) => {
                        const next = [...recipients];
                        next[index] = { ...r, name: e.target.value };
                        setRecipients(next);
                        setSaved(false);
                      }}
                    />
                    <input
                      className="mctb-notif-field"
                      placeholder="Role (Owner, On-call)"
                      value={r.roleDescription || ""}
                      onChange={(e) => {
                        const next = [...recipients];
                        next[index] = { ...r, roleDescription: e.target.value };
                        setRecipients(next);
                        setSaved(false);
                      }}
                    />
                    <input
                      className="mctb-notif-field"
                      placeholder="Email"
                      type="email"
                      value={r.email || ""}
                      onChange={(e) => {
                        const next = [...recipients];
                        next[index] = { ...r, email: e.target.value };
                        setRecipients(next);
                        setSaved(false);
                      }}
                    />
                    <input
                      className="mctb-notif-field"
                      placeholder="Mobile +1…"
                      value={r.mobileE164 || ""}
                      onChange={(e) => {
                        const next = [...recipients];
                        next[index] = { ...r, mobileE164: e.target.value };
                        setRecipients(next);
                        setSaved(false);
                      }}
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="mt-2 text-[13px] font-semibold text-[#1b1e23] underline underline-offset-2"
                onClick={() => {
                  setRecipients([
                    ...recipients,
                    {
                      id: "",
                      name: "",
                      email: null,
                      mobileE164: null,
                      roleDescription: null,
                      eventChannels: {},
                      enabled: true,
                      sortOrder: recipients.length,
                    },
                  ]);
                  setSaved(false);
                }}
              >
                + Add recipient
              </button>
            </section>

            <section className="mctb-notif-module">
              <h3 className="mctb-notif-module__title">Notification events</h3>
              <p className="mctb-notif-module__sub">
                Workspace-wide channels for each handoff event (applies to enabled recipients).
              </p>
              <table className="mctb-notif-event-table">
                <thead>
                  <tr>
                    <th style={{ width: "46%" }}>Event</th>
                    <th style={{ width: "14%" }}>Email</th>
                    <th style={{ width: "14%" }}>SMS</th>
                    <th style={{ width: "14%" }}>In-app</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUTING_EVENT_ROWS.map((event) => {
                    const row = routingRow(config, event);
                    const ch = row.channels || {};
                    return (
                      <tr key={event}>
                        <td data-label="Event">{HANDOFF_EVENT_LABELS[event]}</td>
                        <td data-label="Email">
                          <ChannelCheck
                            checked={Boolean(ch.email)}
                            label={`Email for ${HANDOFF_EVENT_LABELS[event]}`}
                            onChange={(on) => updateRoutingChannel(event, "email", on)}
                          />
                        </td>
                        <td data-label="SMS">
                          <ChannelCheck
                            checked={Boolean(ch.sms)}
                            label={`SMS for ${HANDOFF_EVENT_LABELS[event]}`}
                            onChange={(on) => updateRoutingChannel(event, "sms", on)}
                          />
                        </td>
                        <td data-label="In-app">
                          <ChannelCheck
                            checked={Boolean(ch.in_app)}
                            label={`In-app for ${HANDOFF_EVENT_LABELS[event]}`}
                            onChange={(on) => updateRoutingChannel(event, "in_app", on)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>

            <section className="mctb-notif-module">
              <h3 className="mctb-notif-module__title">Quiet hours</h3>
              <p className="mctb-notif-module__sub">
                Controls when your team is alerted — not customer recovery texting.
              </p>
              <div className="mctb-notif-toggle-row">
                <span>Enable quiet hours</span>
                <ToggleSwitch
                  checked={config.quietHours.enabled}
                  label="Quiet hours"
                  onChange={(on) => {
                    setConfig({
                      ...config,
                      quietHours: { ...config.quietHours, enabled: on },
                    });
                    setSaved(false);
                  }}
                />
              </div>
              {config.quietHours.enabled ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    type="time"
                    className="mctb-notif-field"
                    value={config.quietHours.start || "22:00"}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        quietHours: { ...config.quietHours, start: e.target.value },
                      });
                      setSaved(false);
                    }}
                    aria-label="Quiet hours start"
                  />
                  <input
                    type="time"
                    className="mctb-notif-field"
                    value={config.quietHours.end || "07:00"}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        quietHours: { ...config.quietHours, end: e.target.value },
                      });
                      setSaved(false);
                    }}
                    aria-label="Quiet hours end"
                  />
                </div>
              ) : null}
              <div className="mctb-notif-toggle-row mt-2">
                <span>Emergency bypasses quiet hours</span>
                <ToggleSwitch
                  checked={config.quietHours.emergencyBypass}
                  label="Emergency bypass"
                  onChange={(on) => {
                    setConfig({
                      ...config,
                      quietHours: { ...config.quietHours, emergencyBypass: on },
                    });
                    setSaved(false);
                  }}
                />
              </div>
              <div className="mctb-notif-toggle-row">
                <span>Delay non-urgent SMS during quiet hours</span>
                <ToggleSwitch
                  checked={config.quietHours.nonUrgentSmsDelay}
                  label="Delay non-urgent SMS"
                  onChange={(on) => {
                    setConfig({
                      ...config,
                      quietHours: { ...config.quietHours, nonUrgentSmsDelay: on },
                    });
                    setSaved(false);
                  }}
                />
              </div>
            </section>

            <section className="mctb-notif-module">
              <h3 className="mctb-notif-module__title">Test notifications</h3>
              <p className="mctb-notif-module__sub">
                Sends a safe preview lead summary through configured channels (no customer event).
              </p>
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary"
                disabled={testBusy || saving}
                onClick={() => void sendTest()}
              >
                {testBusy ? "Sending…" : "Send test notification"}
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["normal", "urgent", "email"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`rounded-md border px-3 py-1 text-[12px] font-semibold ${
                      previewTab === tab
                        ? "border-[#1b1e23] bg-[#1b1e23] text-white"
                        : "border-[#dfe3e8] bg-white text-[#626872]"
                    }`}
                    onClick={() => setPreviewTab(tab)}
                  >
                    {tab === "normal" ? "Lead SMS" : tab === "urgent" ? "Emergency SMS" : "Email"}
                  </button>
                ))}
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg border border-[#eef0f2] bg-[#fafbfc] p-3 text-[12px] leading-relaxed text-[#374151]">
                {TEST_PREVIEW[previewTab]}
              </pre>
            </section>
          </div>

          <aside className="mctb-notif-rail" aria-label="Notification context">
            <div className="mctb-notif-module">
              <h4 className="mctb-notif-module__title">Notification summary</h4>
              <div className="mctb-notif-kv">
                <span className="mctb-notif-kv__label">Recipients</span>
                <span className="mctb-notif-kv__value">{enabledRecipientCount(recipients)}</span>
              </div>
              <div className="mctb-notif-kv">
                <span className="mctb-notif-kv__label">Primary email</span>
                <span className="mctb-notif-kv__value">{primaryEmailDestination(recipients)}</span>
              </div>
              <div className="mctb-notif-kv">
                <span className="mctb-notif-kv__label">SMS number</span>
                <span className="mctb-notif-kv__value">{primarySmsDestination(recipients)}</span>
              </div>
              <div className="mctb-notif-kv">
                <span className="mctb-notif-kv__label">Handoff mode</span>
                <span className="mctb-notif-kv__value">{handoffModeLabel(config.responseMode)}</span>
              </div>
              <div className="mctb-notif-kv">
                <span className="mctb-notif-kv__label">Emergency</span>
                <span className="mctb-notif-kv__value">
                  {config.emergencyDetectionEnabled ? "On" : "Off"}
                </span>
              </div>
              <div className="mctb-notif-kv">
                <span className="mctb-notif-kv__label">Quiet hours</span>
                <span className="mctb-notif-kv__value">
                  {config.quietHours.enabled ? "On" : "Off"}
                </span>
              </div>
            </div>

            <div className="mctb-notif-module">
              <h4 className="mctb-notif-module__title">When a caller responds</h4>
              <div className="mctb-notif-mini-flow">
                {flow.map((step, i) => (
                  <Fragment key={step}>
                    <div>{step}</div>
                    {i < flow.length - 1 ? (
                      <div className="mctb-notif-mini-flow__arrow" aria-hidden>↓</div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
              <Link
                href={MCTB_ROUTES.conversations}
                className="mt-3 inline-block text-[12px] font-semibold text-[#1b1e23] underline"
              >
                Open conversations →
              </Link>
            </div>

            <div className="mctb-notif-module">
              <h4 className="mctb-notif-module__title">Related</h4>
              <Link
                href={MCTB_ROUTES.setupTest}
                className="text-[12.5px] font-medium text-[#1b1e23] underline"
              >
                Test recovery flow →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </MctbSetupShell>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`mctb-notif-switch${checked ? " mctb-notif-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="mctb-notif-switch-thumb" />
    </button>
  );
}

function ChannelCheck({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (on: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}
