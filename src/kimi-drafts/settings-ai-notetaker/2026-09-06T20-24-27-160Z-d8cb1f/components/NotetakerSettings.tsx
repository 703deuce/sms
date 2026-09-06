"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarCheck,
  Check,
  Clock,
  FileText,
  Mic,
  ShieldCheck,
  Video,
} from "lucide-react";
import {
  bookingTypes,
  initialConfig,
  joinRuleOptions,
  relatedLinks,
  shareOptions,
  summaryTemplateOptions,
  type NotetakerPlatformConfig,
} from "../mock-data";

/* ---------------- Small primitives ---------------- */

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="tv-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

function SwitchRow({
  title,
  desc,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="tv-switch-row">
      <div className="tv-switch-row-text">
        <strong>{title}</strong>
        {desc ? <span>{desc}</span> : null}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  );
}

function SectionCard({
  id,
  icon,
  title,
  desc,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tv-card" id={id}>
      <div className="tv-card-head">
        <div>
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--tv-muted-light)", display: "inline-flex" }}>{icon}</span>
            {title}
          </h2>
          <p>{desc}</p>
        </div>
      </div>
      <div className="tv-card-body">{children}</div>
    </section>
  );
}

/* ---------------- Template previews ---------------- */

const TEMPLATE_SECTIONS: Record<string, string[]> = {
  general: ["Overview", "Key topics discussed", "Decisions made", "Action items & owners", "Next steps"],
  sales: ["Call summary", "Pain points & needs", "Objections raised", "Budget & timeline signals", "Recommended follow-up"],
  consultation: ["Client goals", "Current situation", "Recommendations", "Agreed plan", "Follow-up items"],
  customer_success: ["Account health", "Wins & progress", "Blockers & risks", "Expansion opportunities", "Next check-in"],
  interview: ["Candidate overview", "Key responses", "Strengths observed", "Concerns", "Evaluation notes"],
  project_status: ["Progress since last sync", "Milestones", "Risks & blockers", "Owners & deadlines", "Decisions"],
  one_on_one: ["Discussion topics", "Feedback exchanged", "Support needed", "Commitments", "Next meeting"],
};

/* ---------------- Main component ---------------- */

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export default function NotetakerSettings() {
  const [config, setConfig] = useState<NotetakerPlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const savedSnapshot = useRef<string>("");

  function load() {
    setLoadError(false);
    setLoading(true);
    // Simulated fetch of /api/meetings/settings
    setTimeout(() => {
      setConfig(initialConfig);
      savedSnapshot.current = JSON.stringify(initialConfig);
      setLoading(false);
    }, 650);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setConfig(initialConfig);
      savedSnapshot.current = JSON.stringify(initialConfig);
      setLoading(false);
    }, 650);
    return () => clearTimeout(t);
  }, []);

  const dirty = useMemo(
    () => (config ? JSON.stringify(config) !== savedSnapshot.current : false),
    [config],
  );

  useEffect(() => {
    if (saveState === "saved" || saveState === "error") {
      const t = setTimeout(() => setSaveState(dirty ? "dirty" : "idle"), 3200);
      return () => clearTimeout(t);
    }
  }, [saveState, dirty]);

  function update<K extends keyof NotetakerPlatformConfig>(key: K, value: NotetakerPlatformConfig[K]) {
    if (!config) return;
    setConfig({ ...config, [key]: value });
    if (saveState !== "saving") setSaveState("dirty");
  }

  async function save() {
    if (!config) return;
    setSaveState("saving");
    // Simulated PATCH /api/meetings/settings
    await new Promise((r) => setTimeout(r, 900));
    savedSnapshot.current = JSON.stringify(config);
    setSaveState("saved");
  }

  function reset() {
    if (!config) return;
    setConfig(JSON.parse(savedSnapshot.current));
    setSaveState("idle");
  }

  function toggleType(id: string) {
    if (!config) return;
    const has = config.selectedEventTypeIds.includes(id);
    update(
      "selectedEventTypeIds",
      has
        ? config.selectedEventTypeIds.filter((t) => t !== id)
        : [...config.selectedEventTypeIds, id],
    );
  }

  const enabled = config?.enabled ?? true;
  const disabledFields = !enabled;

  /* ---------------- Loading ---------------- */
  if (loading) {
    return (
      <div className="tv-page">
        <div className="tv-shell">
          <div className="tv-header">
            <div className="tv-header-titles" style={{ width: "100%" }}>
              <div className="tv-skeleton" style={{ width: 180, height: 26, marginBottom: 8 }} />
              <div className="tv-skeleton" style={{ width: 420, height: 14 }} />
            </div>
          </div>
          <div className="tv-grid">
            <div className="tv-stack">
              {[260, 300, 220].map((h, i) => (
                <div key={i} className="tv-card" style={{ padding: 20 }}>
                  <div className="tv-skeleton" style={{ width: 160, height: 16, marginBottom: 16 }} />
                  <div className="tv-skeleton" style={{ width: "100%", height: h - 60 }} />
                </div>
              ))}
            </div>
            <div className="tv-rail">
              <div className="tv-card" style={{ padding: 18 }}>
                <div className="tv-skeleton" style={{ width: "100%", height: 140 }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------- Error ---------------- */
  if (loadError || !config) {
    return (
      <div className="tv-page">
        <div className="tv-shell">
          <div className="tv-card" style={{ padding: 40, textAlign: "center", maxWidth: 480, margin: "80px auto 0" }}>
            <AlertTriangle size={28} style={{ color: "var(--tv-danger)", margin: "0 auto 12px" }} />
            <h2 style={{ fontSize: 16, fontWeight: 650, margin: "0 0 6px" }}>
              Meeting settings couldn’t be loaded
            </h2>
            <p style={{ fontSize: 13, color: "var(--tv-muted)", margin: "0 0 18px" }}>
              We couldn’t retrieve your AI Notetaker configuration. Your saved settings were not changed.
            </p>
            <button className="tv-btn tv-btn-primary" onClick={load}>
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedTemplate = summaryTemplateOptions.find((t) => t.value === config.summaryTemplate);
  const noTypesSelected =
    config.joinRule === "selected_types" && config.selectedEventTypeIds.length === 0;

  return (
    <div className="tv-page">
      <div className="tv-shell">
        {/* Toast */}
        {saveState === "saved" && (
          <div className="tv-toast" role="status">
            <span className="tv-toast-icon"><Check size={13} /></span>
            Meeting settings saved.
          </div>
        )}
        {saveState === "error" && (
          <div className="tv-toast error" role="alert">
            <span className="tv-toast-icon"><AlertTriangle size={13} /></span>
            Couldn’t save changes. Try again.
          </div>
        )}

        {/* Page header */}
        <div className="tv-header">
          <div className="tv-header-titles">
            <h1>Meetings</h1>
            <p>
              Configure how the AI Notetaker joins, records, and summarizes your online meetings.
              These defaults apply across your workspace.
            </p>
          </div>
          <div className="tv-header-actions">
            <button className="tv-btn tv-btn-ghost" onClick={reset} disabled={!dirty || saveState === "saving"}>
              Discard
            </button>
            <button className="tv-btn tv-btn-primary" onClick={() => void save()} disabled={!dirty || saveState === "saving"}>
              {saveState === "saving" ? <span className="tv-spinner" /> : null}
              {saveState === "saving" ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {/* Anchor nav */}
        <nav className="tv-anchor-nav" aria-label="Settings sections">
          <a href="#general" className="active">General</a>
          <a href="#capture">Capture & recap</a>
          <a href="#notifications">Notifications & sharing</a>
          <a href="#retention">Data retention</a>
        </nav>

        {/* Disabled state banner */}
        {!enabled && (
          <div className="tv-note" role="status" style={{ marginBottom: 20 }}>
            <Bot size={15} />
            <span>
              The AI Notetaker is off. It won’t join any meetings and no recordings or recaps will
              be created. Existing recaps remain available under Meetings → Recaps.
            </span>
          </div>
        )}

        <div className="tv-grid">
          {/* ---------------- Main column ---------------- */}
          <div className="tv-stack">
            {/* General */}
            <SectionCard
              id="general"
              icon={<Bot size={16} />}
              title="General"
              desc="Turn the Notetaker on and choose which meetings it joins automatically."
            >
              <SwitchRow
                title="Enable AI Notetaker"
                desc="When off, the Notetaker won’t join any meeting and no recordings or recaps are created."
                checked={config.enabled}
                onChange={(v) => update("enabled", v)}
              />

              <div className="tv-divider" style={{ margin: "2px 0" }} />

              <fieldset className="tv-field" style={{ border: "none", padding: 0, margin: 0 }}>
                <span className="tv-label">Automatically join</span>
                <div className="tv-radio-group" role="radiogroup" aria-label="Automatically join">
                  {joinRuleOptions.map((opt) => (
                    <label key={opt.value} className="tv-radio-card" data-checked={config.joinRule === opt.value}>
                      <input
                        type="radio"
                        name="joinRule"
                        checked={config.joinRule === opt.value}
                        onChange={() => update("joinRule", opt.value)}
                        disabled={disabledFields}
                      />
                      <span className="tv-radio-card-text">
                        <strong>{opt.label}</strong>
                        <span>{opt.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>

                {config.joinRule === "selected_types" && (
                  <>
                    <div className="tv-chip-grid" role="group" aria-label="Appointment types">
                      {bookingTypes.map((bt) => (
                        <button
                          key={bt.id}
                          type="button"
                          className="tv-chip"
                          data-checked={config.selectedEventTypeIds.includes(bt.id)}
                          onClick={() => toggleType(bt.id)}
                          disabled={disabledFields}
                          aria-pressed={config.selectedEventTypeIds.includes(bt.id)}
                        >
                          {bt.name} <small>{bt.duration}</small>
                        </button>
                      ))}
                    </div>
                    {noTypesSelected && (
                      <p className="tv-field-error" role="alert">
                        Select at least one appointment type, or choose a different auto-join rule.
                      </p>
                    )}
                  </>
                )}
              </fieldset>

              <div className="tv-field">
                <label className="tv-label" htmlFor="botName">Notetaker name</label>
                <input
                  id="botName"
                  className="tv-input"
                  value={config.botName}
                  onChange={(e) => update("botName", e.target.value)}
                  placeholder="Transovo Notetaker"
                  disabled={disabledFields}
                  maxLength={60}
                />
                <p className="tv-hint">Shown to participants when the Notetaker joins the meeting.</p>
              </div>
            </SectionCard>

            {/* Capture & recap */}
            <SectionCard
              id="capture"
              icon={<Mic size={16} />}
              title="Capture & recap"
              desc="Control what gets recorded and what the AI generates after each meeting."
            >
              <SwitchRow
                title="Record meetings"
                desc="Capture audio and video for playback later."
                checked={config.recordingEnabled}
                onChange={(v) => update("recordingEnabled", v)}
                disabled={disabledFields}
              />
              <SwitchRow
                title="Transcribe meetings"
                desc="Produce a searchable, speaker-labeled transcript."
                checked={config.transcriptEnabled}
                onChange={(v) => update("transcriptEnabled", v)}
                disabled={disabledFields}
              />
              <SwitchRow
                title="AI summary"
                desc="Generate a structured recap from the transcript."
                checked={config.summaryEnabled}
                onChange={(v) => update("summaryEnabled", v)}
                disabled={disabledFields}
              />
              <SwitchRow
                title="Action items"
                desc="Extract tasks, owners, and deadlines from the conversation."
                checked={config.actionItemsEnabled}
                onChange={(v) => update("actionItemsEnabled", v)}
                disabled={disabledFields}
              />
              <SwitchRow
                title="Follow-up drafts"
                desc="Draft a follow-up email to attendees after each meeting."
                checked={config.followUpEnabled}
                onChange={(v) => update("followUpEnabled", v)}
                disabled={disabledFields}
              />

              <div className="tv-divider" style={{ margin: "2px 0" }} />

              <div className="tv-field">
                <label className="tv-label" htmlFor="summaryTemplate">Summary template</label>
                <select
                  id="summaryTemplate"
                  className="tv-select"
                  value={config.summaryTemplate}
                  onChange={(e) => update("summaryTemplate", e.target.value as NotetakerPlatformConfig["summaryTemplate"])}
                  disabled={disabledFields || !config.summaryEnabled}
                >
                  {summaryTemplateOptions.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {selectedTemplate && <p className="tv-hint">{selectedTemplate.desc}</p>}
              </div>

              {config.summaryEnabled && (
                <div className="tv-template-preview" aria-label="Template section preview">
                  <h4>Recap sections — {selectedTemplate?.label}</h4>
                  <ul>
                    {(TEMPLATE_SECTIONS[config.summaryTemplate] ?? TEMPLATE_SECTIONS.general).map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>

            {/* Notifications & sharing */}
            <SectionCard
              id="notifications"
              icon={<CalendarCheck size={16} />}
              title="Notifications & sharing"
              desc="Decide how attendees are informed and who receives the recap."
            >
              <SwitchRow
                title="Notify attendees in advance"
                desc="Add a disclosure to invitations and reminders that the Notetaker may join."
                checked={config.notifyAttendeesAdvance}
                onChange={(v) => update("notifyAttendeesAdvance", v)}
                disabled={disabledFields}
              />

              {config.notifyAttendeesAdvance && (
                <div className="tv-field">
                  <label className="tv-label" htmlFor="noticeText">Advance notice text</label>
                  <textarea
                    id="noticeText"
                    className="tv-textarea"
                    rows={3}
                    value={config.advanceNoticeText}
                    onChange={(e) => update("advanceNoticeText", e.target.value)}
                    disabled={disabledFields}
                  />
                  <p className="tv-hint">
                    Included in booking confirmations and reminder messages. Required in many regions
                    for recording disclosure.
                  </p>
                </div>
              )}

              <div className="tv-divider" style={{ margin: "2px 0" }} />

              <SwitchRow
                title="Email me when a recap is ready"
                desc="Get a notification as soon as the summary and transcript are processed."
                checked={config.emailOnRecapReady}
                onChange={(v) => update("emailOnRecapReady", v)}
                disabled={disabledFields}
              />

              <fieldset className="tv-field" style={{ border: "none", padding: 0, margin: 0 }}>
                <span className="tv-label">Share recap automatically with</span>
                <div className="tv-radio-group" role="radiogroup" aria-label="Share recap with">
                  {shareOptions.map((opt) => (
                    <label key={opt.value} className="tv-radio-card" data-checked={config.autoShareWith === opt.value}>
                      <input
                        type="radio"
                        name="autoShareWith"
                        checked={config.autoShareWith === opt.value}
                        onChange={() => update("autoShareWith", opt.value)}
                        disabled={disabledFields}
                      />
                      <span className="tv-radio-card-text">
                        <strong>{opt.label}</strong>
                        <span>{opt.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </SectionCard>

            {/* Retention */}
            <SectionCard
              id="retention"
              icon={<ShieldCheck size={16} />}
              title="Data retention"
              desc="How long recordings and transcripts are kept before automatic deletion."
            >
              <div className="tv-field-row">
                <div className="tv-field">
                  <label className="tv-label" htmlFor="recRetention">Recording retention</label>
                  <div className="tv-input-suffix">
                    <input
                      id="recRetention"
                      type="number"
                      min={1}
                      max={3650}
                      className="tv-input"
                      value={config.recordingRetentionDays}
                      onChange={(e) => update("recordingRetentionDays", Math.max(1, Number(e.target.value) || 90))}
                      disabled={disabledFields}
                    />
                    <span>days</span>
                  </div>
                  <p className="tv-hint">Audio & video files are deleted after this period.</p>
                </div>
                <div className="tv-field">
                  <label className="tv-label" htmlFor="trxRetention">Transcript retention</label>
                  <div className="tv-input-suffix">
                    <input
                      id="trxRetention"
                      type="number"
                      min={1}
                      max={3650}
                      className="tv-input"
                      value={config.transcriptRetentionDays}
                      onChange={(e) => update("transcriptRetentionDays", Math.max(1, Number(e.target.value) || 365))}
                      disabled={disabledFields}
                    />
                    <span>days</span>
                  </div>
                  <p className="tv-hint">Transcripts, summaries, and action items.</p>
                </div>
              </div>

              <div className="tv-note">
                <AlertTriangle size={15} />
                <span>
                  Deletion is permanent and applies to all attendees’ data. Shorter retention reduces
                  privacy risk but removes access to past recordings. Retention changes apply to new
                  meetings immediately and to existing artifacts on their next evaluation cycle.
                </span>
              </div>
            </SectionCard>

            {/* Sticky save bar */}
            <div className="tv-savebar">
              <div className="tv-savebar-status">
                <span className={`tv-dot${dirty ? " dirty" : ""}`} />
                {saveState === "saving"
                  ? "Saving changes…"
                  : dirty
                    ? "You have unsaved changes"
                    : "All changes saved"}
              </div>
              <div className="tv-savebar-actions">
                <button className="tv-btn tv-btn-outline" onClick={reset} disabled={!dirty || saveState === "saving"}>
                  Discard
                </button>
                <button className="tv-btn tv-btn-primary" onClick={() => void save()} disabled={!dirty || saveState === "saving"}>
                  {saveState === "saving" ? <span className="tv-spinner" /> : null}
                  {saveState === "saving" ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>

          {/* ---------------- Right rail ---------------- */}
          <aside className="tv-rail">
            <div className="tv-card tv-status-card">
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 650 }}>Status</h3>
              <div className="tv-status-row">
                <span className="k"><Bot size={14} /> AI Notetaker</span>
                <span className={`tv-badge ${enabled ? "on" : "off"}`}>{enabled ? "Enabled" : "Off"}</span>
              </div>
              <div className="tv-status-row">
                <span className="k"><Video size={14} /> Auto-join</span>
                <span className="v">{joinRuleOptions.find((o) => o.value === config.joinRule)?.label}</span>
              </div>
              <div className="tv-status-row">
                <span className="k"><FileText size={14} /> Template</span>
                <span className="v">{selectedTemplate?.label}</span>
              </div>
              <div className="tv-status-row">
                <span className="k"><Clock size={14} /> Last updated</span>
                <span className="v">Sep 5 · 11:24 AM</span>
              </div>
            </div>

            <div className="tv-card tv-link-card">
              <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 650 }}>Related</h3>
              {relatedLinks.map((l) => (
                <a key={l.href} className="tv-link-row" href={l.href}>
                  {l.label} <ArrowUpRight size={14} />
                </a>
              ))}
            </div>

            <div className="tv-note" style={{ background: "var(--tv-primary-soft)", borderColor: "#c7d0fd", color: "#3538cd" }}>
              <ShieldCheck size={15} />
              <span>
                Recording laws vary by region. Keep advance notice enabled so attendees are informed
                before the Notetaker joins.
              </span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
