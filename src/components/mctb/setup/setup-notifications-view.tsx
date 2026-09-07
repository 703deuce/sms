"use client";

import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import {
  MctbSmsPreviewPanel,
  SelectableCard,
  WizardPageLayout,
  WizardQuestionBlock,
} from "@/components/mctb/wizard/mctb-wizard-ui";
import { RESPONSE_MODE_LABELS } from "@/lib/mctb/handoff/defaults";
import type {
  MctbHandoffConfigDto,
  MctbLeadFieldConfig,
  MctbNotificationRecipientDto,
  MctbResponseMode,
} from "@/lib/mctb/handoff/types";
import { MCTB_RESPONSE_MODES } from "@/lib/mctb/handoff/types";
import {
  AlertTriangle,
  Bell,
  Bot,
  ClipboardList,
  MessageSquare,
  UserCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../kimi-ui/reference.css";

const MODE_ICONS: Record<MctbResponseMode, typeof Bell> = {
  notify_only: Bell,
  guided_collection: ClipboardList,
  ai_conversation: Bot,
  immediate_handoff: UserCheck,
};

export function MctbSetupNotificationsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<MctbHandoffConfigDto | null>(null);
  const [recipients, setRecipients] = useState<MctbNotificationRecipientDto[]>([]);
  const [previewTab, setPreviewTab] = useState<"normal" | "urgent" | "email">("normal");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/handoff", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setConfig(json.data.config);
      setRecipients(json.data.recipients || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setSaving(true);
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
      setSaving(false);
    }
  }

  function updateField(id: string, requirement: MctbLeadFieldConfig["requirement"]) {
    if (!config) return;
    setConfig({
      ...config,
      fieldSchema: config.fieldSchema.map((f) =>
        f.id === id ? { ...f, requirement } : f,
      ),
    });
  }

  const statusStrip = useMemo(() => {
    if (!config) return null;
    return [
      { label: "Response mode", value: RESPONSE_MODE_LABELS[config.responseMode]?.title || config.responseMode },
      {
        label: "Emergency",
        value: config.emergencyDetectionEnabled ? "On" : "Off",
      },
      { label: "Recipients", value: String(recipients.filter((r) => r.enabled).length) },
    ];
  }, [config, recipients]);

  if (loading || !config) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner">
          <div className="ref-card p-12 text-center text-sm text-gray-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <MctbSetupSectionLayout
      title="Notifications & Handoff"
      description="Choose what happens after a missed caller responds and who should be notified."
      saving={saving}
      saved={saved}
      error={error}
      onSave={() => void save()}
    >
      {statusStrip ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {statusStrip.map((item) => (
            <div key={item.label} className="ref-card flex items-center gap-3 p-4">
              <div className="icon-tile tile-purple">
                <Bell size={18} aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {item.label}
                </p>
                <p className="text-[13px] font-semibold text-gray-900">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="ref-card p-5 voice-theme">
        <WizardPageLayout
          aside={
            <MctbSmsPreviewPanel
              press1Mode={false}
              compliancePreview=""
              openerPreview="Hi — sorry we missed your call. How can we help?"
              senderLabel="Your business"
            />
          }
        >
          <WizardQuestionBlock
            number={1}
            title="What should happen when a caller replies?"
            subtitle="Four distinct modes — each changes runtime behavior, not just labels."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {MCTB_RESPONSE_MODES.map((mode) => {
                const Icon = MODE_ICONS[mode];
                const meta = RESPONSE_MODE_LABELS[mode];
                return (
                  <SelectableCard
                    key={mode}
                    selected={config.responseMode === mode}
                    onClick={() => setConfig({ ...config, responseMode: mode })}
                    title={meta.title}
                    description={meta.subtitle}
                    icon={<Icon className="h-5 w-5" aria-hidden />}
                  />
                );
              })}
            </div>
          </WizardQuestionBlock>
        </WizardPageLayout>
      </div>

      {config.responseMode === "guided_collection" ? (
        <div className="ref-card mt-6 p-5 voice-theme">
          <WizardQuestionBlock
            number={2}
            title="Information to collect"
            subtitle="Off / Optional / Required before normal handoff."
          >
            <ul className="space-y-2">
              {config.fieldSchema
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((field) => (
                  <li
                    key={field.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3"
                  >
                    <span className="text-[13px] font-semibold text-gray-900">{field.label}</span>
                    <select
                      className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px]"
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
          </WizardQuestionBlock>
        </div>
      ) : null}

      <div className="ref-card mt-6 overflow-hidden border-amber-200/80 p-5 voice-theme">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-800" aria-hidden />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-gray-900">Emergency handling</h2>
            <p className="text-[12px] text-gray-600">High-consequence — independent from response mode.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <input
            type="checkbox"
            checked={config.emergencyDetectionEnabled}
            onChange={(e) =>
              setConfig({ ...config, emergencyDetectionEnabled: e.target.checked })
            }
          />
          Emergency detection on
        </label>
        {config.emergencyDetectionEnabled ? (
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700" htmlFor="urgency-criteria">
                What should Transovo consider urgent?
              </label>
              <textarea
                id="urgency-criteria"
                className="mt-1.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px]"
                rows={3}
                placeholder="e.g. active flooding, burst pipe, no heat, locked out"
                value={config.emergencyCriteria || ""}
                onChange={(e) =>
                  setConfig({ ...config, emergencyCriteria: e.target.value || null })
                }
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700" htmlFor="emergency-action">
                When urgency is detected
              </label>
              <select
                id="emergency-action"
                className="mt-1.5 h-10 w-full rounded-lg border border-gray-200 px-3 text-[13px]"
                value={config.emergencyAction}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    emergencyAction: e.target.value as MctbHandoffConfigDto["emergencyAction"],
                  })
                }
              >
                <option value="notify_only">Notify only</option>
                <option value="callback_request">Create urgent callback request</option>
                <option value="notify_emergency_contacts">Notify emergency contacts</option>
                <option value="ai_continue_notify">Continue AI while notifying team</option>
                <option value="stop_ai_handoff">Stop AI and hand off immediately</option>
              </select>
            </div>
          </div>
        ) : null}
      </div>

      <div className="ref-card mt-6 p-5 voice-theme">
        <WizardQuestionBlock
          number={3}
          title="Notification recipients"
          subtitle="Who receives alerts for lead capture, callbacks, and emergencies."
        >
          <div className="space-y-3">
            {recipients.map((r, index) => (
              <div key={r.id || index} className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="h-10 rounded-lg border border-gray-200 px-3 text-[13px]"
                    placeholder="Name"
                    value={r.name}
                    onChange={(e) => {
                      const next = [...recipients];
                      next[index] = { ...r, name: e.target.value };
                      setRecipients(next);
                    }}
                  />
                  <input
                    className="h-10 rounded-lg border border-gray-200 px-3 text-[13px]"
                    placeholder="Role (e.g. Owner, On-call)"
                    value={r.roleDescription || ""}
                    onChange={(e) => {
                      const next = [...recipients];
                      next[index] = { ...r, roleDescription: e.target.value };
                      setRecipients(next);
                    }}
                  />
                  <input
                    className="h-10 rounded-lg border border-gray-200 px-3 text-[13px]"
                    placeholder="Mobile +1…"
                    value={r.mobileE164 || ""}
                    onChange={(e) => {
                      const next = [...recipients];
                      next[index] = { ...r, mobileE164: e.target.value };
                      setRecipients(next);
                    }}
                  />
                  <input
                    className="h-10 rounded-lg border border-gray-200 px-3 text-[13px]"
                    placeholder="Email"
                    type="email"
                    value={r.email || ""}
                    onChange={(e) => {
                      const next = [...recipients];
                      next[index] = { ...r, email: e.target.value };
                      setRecipients(next);
                    }}
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-800"
              onClick={() =>
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
                ])
              }
            >
              + Add recipient
            </button>
          </div>
        </WizardQuestionBlock>
      </div>

      <div className="ref-card mt-6 p-5 voice-theme">
        <WizardQuestionBlock
          number={4}
          title="Business notification quiet hours"
          subtitle="Controls when your team is alerted — not customer recovery texting."
        >
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={config.quietHours.enabled}
              onChange={(e) =>
                setConfig({
                  ...config,
                  quietHours: { ...config.quietHours, enabled: e.target.checked },
                })
              }
            />
            Enable quiet hours for non-urgent team notifications
          </label>
          {config.quietHours.enabled ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                type="time"
                className="h-10 rounded-lg border border-gray-200 px-3 text-[13px]"
                value={config.quietHours.start || "22:00"}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    quietHours: { ...config.quietHours, start: e.target.value },
                  })
                }
                aria-label="Quiet hours start"
              />
              <input
                type="time"
                className="h-10 rounded-lg border border-gray-200 px-3 text-[13px]"
                value={config.quietHours.end || "07:00"}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    quietHours: { ...config.quietHours, end: e.target.value },
                  })
                }
                aria-label="Quiet hours end"
              />
            </div>
          ) : null}
          <label className="mt-3 flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={config.quietHours.emergencyBypass}
              onChange={(e) =>
                setConfig({
                  ...config,
                  quietHours: { ...config.quietHours, emergencyBypass: e.target.checked },
                })
              }
            />
            Emergency alerts bypass quiet hours
          </label>
        </WizardQuestionBlock>
      </div>

      <div className="ref-card mt-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" aria-hidden />
            <h2 className="text-[15px] font-semibold">Test notifications</h2>
          </div>
          <button
            type="button"
            className="voice-btn-secondary text-[13px]"
            disabled={saving}
            onClick={() => void sendTest()}
          >
            Send test notification
          </button>
        </div>
        <p className="mt-2 text-[12px] text-gray-600">
          Sends a safe preview lead summary through your configured channels (no customer event).
        </p>
        <div className="mt-4 flex gap-2">
          {(["normal", "urgent", "email"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                previewTab === tab
                  ? "bg-indigo-100 text-indigo-800"
                  : "bg-gray-100 text-gray-600"
              }`}
              onClick={() => setPreviewTab(tab)}
            >
              {tab === "normal" ? "Lead SMS" : tab === "urgent" ? "Emergency SMS" : "Email"}
            </button>
          ))}
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-gray-50 p-4 text-[12px] leading-relaxed text-gray-800">
          {previewTab === "urgent"
            ? "URGENT — callback requested\n\nSarah Wilson\n(703) 555-1234\n\nCustomer says water is coming through the ceiling.\nUrgency: High"
            : previewTab === "email"
              ? "Subject: New missed-call lead\nCaller, phone, need, location, callback preference, and conversation link."
              : "New missed-call lead\n\nAnthony Johnson\n(571) 555-1234\n\nWater heater estimate\nWoodbridge, VA\nCallback after 4 PM"}
        </pre>
      </div>
    </MctbSetupSectionLayout>
  );
}
