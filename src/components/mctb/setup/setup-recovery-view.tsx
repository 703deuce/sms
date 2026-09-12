"use client";

import { MctbSetupShell } from "@/components/mctb/setup/mctb-setup-shell";
import "./mctb-setup-recovery.css";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { addPauseUntil } from "@/lib/mctb/schedule-shared";
import { formatCompactWhen } from "@/lib/mctb/setup-phone-forwarding-model";
import {
  COOLDOWN_PRESETS_MINUTES,
  consentSummary,
  countActiveTriggers,
  cooldownPresetLabel,
  formatDelayLabel,
  formatSuppressionRow,
  formatTriggerSummary,
  isCooldownPreset,
  recoverySnapshotsEqual,
  SUPPRESSION_EXPLAINERS,
  TRIGGER_OPTIONS,
  type RecoverySnapshot,
  type TriggerState,
} from "@/lib/mctb/setup-recovery-model";
import {
  Check,
  ChevronRight,
  PhoneMissed,
  Power,
  RefreshCw,
  Repeat,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SetupRuntime = {
  phoneNumberId: string | null;
  enabled: boolean;
  sendAfterNoAnswer: boolean;
  sendAfterBusy: boolean;
  sendAfterRejected: boolean;
  sendAfterTimeout: boolean;
  sendAfterVoicemail: boolean;
  cooldownMinutes: number;
  delaySeconds: number;
  maxMessagesPerCaller: number;
  messageTemplate: string;
  timezone: string;
  scheduleMode?: string;
};

type ScheduleSlice = {
  paused: boolean;
  pauseUntil: string | null;
  pauseKind: "manual" | "timed" | null;
  scheduleMode?: string;
};

type SolutionSlice = {
  config?: {
    followUpEnabled?: boolean;
    followUpDelayMinutes?: number;
    firstMessage?: string;
  };
};

export function MctbSetupRecoveryView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<TriggerState>({
    noAnswer: true,
    busy: true,
    rejected: true,
    timeout: true,
    voicemail: false,
  });
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [cooldownCustom, setCooldownCustom] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [schedule, setSchedule] = useState<ScheduleSlice>({
    paused: false,
    pauseUntil: null,
    pauseKind: null,
  });
  const [timezone, setTimezone] = useState("America/New_York");
  const [consentMode, setConsentMode] = useState<MctbConsentMode>("press_1");
  const [messagingReady, setMessagingReady] = useState(false);
  const [messagePreview, setMessagePreview] = useState("");
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [maxMessages, setMaxMessages] = useState(1);
  const [scheduleMode, setScheduleMode] = useState("always_on");
  const [forwardingVerified, setForwardingVerified] = useState(true);
  const [baseline, setBaseline] = useState<RecoverySnapshot | null>(null);
  const [recentSuppressions, setRecentSuppressions] = useState<
    Array<{ phone: string; reason: string; time: string }>
  >([]);
  const [lastRecoveryAt, setLastRecoveryAt] = useState<string | null>(null);
  const [voicemailReady, setVoicemailReady] = useState(false);

  const [pauseOpen, setPauseOpen] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const [pauseChoice, setPauseChoice] = useState<"1h" | "tomorrow" | "24h" | "custom" | "manual">("1h");
  const [pauseCustomAt, setPauseCustomAt] = useState("");
  const [delayModalOpen, setDelayModalOpen] = useState(false);
  const [delayDraft, setDelayDraft] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [setupRes, onboardRes, suppressedRes, recentRes] = await Promise.all([
        fetch("/api/mctb/setup", { cache: "no-store" }),
        fetch("/api/mctb/onboarding", { cache: "no-store" }),
        fetch("/api/mctb/missed-calls?status=suppressed&date=7d&pageSize=5&sort=detectedAt_desc", {
          cache: "no-store",
        }),
        fetch("/api/mctb/missed-calls?date=7d&pageSize=15&sort=detectedAt_desc", {
          cache: "no-store",
        }),
      ]);

      const setupJson = await setupRes.json();
      if (!setupRes.ok) throw new Error(setupJson.error || "Failed to load setup");
      const data = setupJson.data;
      const r = data.runtime as SetupRuntime;
      const sch = data.schedule as ScheduleSlice;
      const sol = data.solution as SolutionSlice | null;

      setPhoneNumberId(r.phoneNumberId);
      setTriggers({
        noAnswer: r.sendAfterNoAnswer,
        busy: r.sendAfterBusy,
        rejected: r.sendAfterRejected,
        timeout: r.sendAfterTimeout,
        voicemail: r.sendAfterVoicemail,
      });
      setCooldownMinutes(r.cooldownMinutes ?? 60);
      setCooldownCustom(!isCooldownPreset(r.cooldownMinutes ?? 60));
      setDelaySeconds(r.delaySeconds ?? 0);
      setTimezone(r.timezone || "America/New_York");
      setSchedule({
        paused: Boolean(sch?.paused),
        pauseUntil: sch?.pauseUntil ?? null,
        pauseKind: sch?.pauseKind ?? null,
      });
      setScheduleMode(sch?.scheduleMode || r.scheduleMode || "always_on");
      setConsentMode(data.consentMode || "press_1");
      setMessagingReady(Boolean(data.compliance?.messagingReady));
      setMessagePreview(r.messageTemplate?.trim() || sol?.config?.firstMessage?.trim() || "");
      setFollowUpEnabled(Boolean(sol?.config?.followUpEnabled));
      setMaxMessages(r.maxMessagesPerCaller ?? 1);

      if (onboardRes.ok) {
        const ob = await onboardRes.json();
        setForwardingVerified(
          Boolean(ob.state?.forwardingConnectedAt || ob.forwardingVerification?.verified),
        );
      }

      if (suppressedRes.ok) {
        const sup = await suppressedRes.json();
        const rows = (sup.data?.events || []) as Array<{
          callerE164: string;
          suppressionReason: string | null;
          detectedAt: string;
        }>;
        setRecentSuppressions(
          rows.map((e) =>
            formatSuppressionRow(e.callerE164, e.suppressionReason, e.detectedAt),
          ),
        );
      } else {
        setRecentSuppressions([]);
      }

      if (recentRes.ok) {
        const rec = await recentRes.json();
        const events = (rec.data?.events || []) as Array<{
          smsSentAt: string | null;
          detectedAt: string;
          status: string;
        }>;
        const sent = events.find((e) => e.smsSentAt || e.status === "SENT");
        setLastRecoveryAt(sent?.smsSentAt || sent?.detectedAt || null);
      }

      const pid = r.phoneNumberId;
      if (pid) {
        const vmRes = await fetch(`/api/phone/voicemail?phoneNumberId=${encodeURIComponent(pid)}`, {
          cache: "no-store",
        });
        if (vmRes.ok) {
          const vm = await vmRes.json();
          const box = vm.box || vm.data?.box;
          setVoicemailReady(Boolean(box?.greetingUrl || box?.greetingText));
        }
      }

      const snap: RecoverySnapshot = {
        phoneNumberId: r.phoneNumberId,
        triggers: {
          noAnswer: r.sendAfterNoAnswer,
          busy: r.sendAfterBusy,
          rejected: r.sendAfterRejected,
          timeout: r.sendAfterTimeout,
          voicemail: r.sendAfterVoicemail,
        },
        cooldownMinutes: r.cooldownMinutes ?? 60,
        delaySeconds: r.delaySeconds ?? 0,
      };
      setBaseline(snap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const paused = schedule.paused;
  const activeTriggers = countActiveTriggers(triggers);

  const currentSnapshot: RecoverySnapshot = useMemo(
    () => ({
      phoneNumberId,
      triggers,
      cooldownMinutes,
      delaySeconds,
    }),
    [phoneNumberId, triggers, cooldownMinutes, delaySeconds],
  );

  const dirty = baseline ? !recoverySnapshotsEqual(baseline, currentSnapshot) : false;

  const pauseLabel = useMemo(() => {
    if (!paused) return null;
    if (schedule.pauseKind === "timed" && schedule.pauseUntil) {
      return `Until ${formatCompactWhen(schedule.pauseUntil) || new Date(schedule.pauseUntil).toLocaleString()}`;
    }
    return "Until manually resumed";
  }, [paused, schedule.pauseKind, schedule.pauseUntil]);

  const scheduleModeLabel = useMemo(() => {
    switch (scheduleMode) {
      case "business_hours":
        return "Business hours only";
      case "after_hours":
        return "After hours only";
      case "custom":
        return "Custom schedule";
      default:
        return "Same rules (always on)";
    }
  }, [scheduleMode]);

  async function save() {
    if (activeTriggers === 0) {
      setError("Select at least one missed-call outcome.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumberId,
          triggerRules: triggers,
          cooldownMinutes,
          delaySeconds,
          activate: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setBaseline(currentSnapshot);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function postPause(body: Record<string, unknown>) {
    setPauseBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Pause request failed");
      setPauseOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setPauseBusy(false);
    }
  }

  async function confirmPause() {
    if (pauseChoice === "manual") {
      await postPause({ enabled: false, pauseUntil: null });
      return;
    }
    if (pauseChoice === "custom" && pauseCustomAt) {
      await postPause({ pauseUntil: new Date(pauseCustomAt).toISOString() });
      return;
    }
    const until =
      pauseChoice === "24h"
        ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        : addPauseUntil(pauseChoice === "tomorrow" ? "tomorrow" : "1h", timezone);
    await postPause({ pauseUntil: until });
  }

  async function resumeNow() {
    await postPause({ enabled: true, pauseUntil: null });
  }

  function toggleTrigger(key: keyof TriggerState) {
    setTriggers((t) => ({ ...t, [key]: !t[key] }));
    setSaved(false);
  }

  const headerPauseControl = paused ? (
    <button
      type="button"
      className="mctb-setup-btn mctb-setup-btn--primary"
      disabled={pauseBusy}
      onClick={() => void resumeNow()}
    >
      Resume recovery
    </button>
  ) : (
    <button
      type="button"
      className="mctb-setup-btn mctb-setup-btn--outline"
      disabled={pauseBusy}
      onClick={() => setPauseOpen(true)}
    >
      Pause recovery ▾
    </button>
  );

  const headerAction = (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {headerPauseControl}
      {saved && !saving && !dirty ? (
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#1f6b42]">
          <Check className="h-4 w-4" aria-hidden />
          Saved
        </span>
      ) : null}
      <button
        type="button"
        className="mctb-setup-btn mctb-setup-btn--primary"
        style={{ minWidth: "7.5rem" }}
        disabled={saving || !dirty}
        onClick={() => void save()}
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );

  const shellProps = {
    title: "Setup",
    description:
      "Configure missed-call recovery, forwarding, consent, voicemail, and operational controls.",
  };

  if (loading) {
    return (
      <MctbSetupShell {...shellProps}>
        <div className="mctb-recovery-page">
          <div className="mctb-setup-skel h-20 mb-4" />
          <div className="mctb-setup-skel h-96" />
        </div>
      </MctbSetupShell>
    );
  }

  return (
    <MctbSetupShell {...shellProps}>
      <div className="mctb-recovery-page">
        <header className="mctb-recovery-section-header">
          <div className="mctb-recovery-section-header__left">
            <div className="mctb-recovery-section-header__icon">
              <RefreshCw className="h-4 w-4" strokeWidth={1.85} aria-hidden />
            </div>
            <div>
              <h2 className="mctb-recovery-section-header__title">Recovery</h2>
              <p className="mctb-recovery-section-header__desc">
                Control which missed calls trigger recovery and how repeat callers are handled.
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

        {!forwardingVerified ? (
          <div className="mctb-recovery-warn" role="status">
            Forwarding has not been verified. Recovery will not operate reliably until calls reach
            Transovo.{" "}
            <Link href={MCTB_ROUTES.setupPhone} className="mctb-recovery-link">
              Fix forwarding →
            </Link>
          </div>
        ) : null}

        <div
          className={`mctb-recovery-status-strip ${paused ? "mctb-recovery-status-strip--paused" : "mctb-recovery-status-strip--active"}`}
          role="status"
        >
          <span
            className={`mctb-recovery-dot ${paused ? "mctb-recovery-dot--paused" : "mctb-recovery-dot--active"}`}
            aria-hidden
          />
          <span className="mctb-recovery-strip-strong">
            {paused ? "Recovery paused" : "Recovery active"}
          </span>
          {paused && pauseLabel ? (
            <span className="mctb-recovery-strip-muted">{pauseLabel}</span>
          ) : null}
          {!paused ? (
            <>
              <span className="mctb-recovery-strip-muted">Triggers: {activeTriggers}</span>
              <span className="mctb-recovery-strip-muted">
                Cooldown: {cooldownPresetLabel(cooldownMinutes)}
              </span>
              {lastRecoveryAt ? (
                <span className="mctb-recovery-strip-muted">
                  Last recovery: {formatCompactWhen(lastRecoveryAt)}
                </span>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              className="mctb-setup-btn mctb-setup-btn--primary"
              style={{ height: "2rem", marginLeft: "auto" }}
              disabled={pauseBusy}
              onClick={() => void resumeNow()}
            >
              Resume now
            </button>
          )}
        </div>

        <div className="mctb-recovery-grid">
          <div className="mctb-recovery-main">
            <section className="mctb-recovery-module" aria-labelledby="mctb-rec-status">
              <div className="mctb-recovery-module__head">
                <div className="mctb-recovery-module__icon">
                  <Power className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h3 id="mctb-rec-status" className="mctb-recovery-module__title">
                    Recovery status
                  </h3>
                  <p className="mctb-recovery-module__desc">
                    Temporarily stop or resume missed-call recovery without changing forwarding.
                  </p>
                </div>
              </div>
              <p className="text-[13px] font-semibold text-[#1b1e23] mb-2">
                Current state: {paused ? "Recovery paused" : "Recovery active"}
              </p>
              {paused && pauseLabel ? (
                <p className="text-[12.5px] text-[#626872] mb-3">{pauseLabel}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {paused ? (
                  <>
                    <button
                      type="button"
                      className="mctb-setup-btn mctb-setup-btn--primary"
                      disabled={pauseBusy}
                      onClick={() => void resumeNow()}
                    >
                      Resume now
                    </button>
                    <button
                      type="button"
                      className="mctb-setup-btn mctb-setup-btn--outline"
                      disabled={pauseBusy}
                      onClick={() => setPauseOpen(true)}
                    >
                      Change pause
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="mctb-setup-btn mctb-setup-btn--outline"
                    disabled={pauseBusy}
                    onClick={() => setPauseOpen(true)}
                  >
                    Pause recovery ▾
                  </button>
                )}
              </div>
              <p className="mt-3 text-[12px] text-[#8b939e] leading-relaxed">
                Pausing stops new automatic recovery texts. Forwarding and voicemail continue on
                the call path.
              </p>
            </section>

            <section className="mctb-recovery-module" aria-labelledby="mctb-rec-triggers">
              <div className="mctb-recovery-module__head">
                <div className="mctb-recovery-module__icon">
                  <PhoneMissed className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h3 id="mctb-rec-triggers" className="mctb-recovery-module__title">
                    What counts as a missed call?
                  </h3>
                  <p className="mctb-recovery-module__desc">
                    Choose which unanswered call outcomes can create a recovery event.
                  </p>
                </div>
              </div>
              <div className="mctb-recovery-outcome-grid" role="group" aria-label="Missed call outcomes">
                {TRIGGER_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className="mctb-recovery-outcome"
                    aria-pressed={triggers[opt.key]}
                    onClick={() => toggleTrigger(opt.key)}
                  >
                    <div className="mctb-recovery-outcome__main">
                      <div className="mctb-recovery-outcome__label">{opt.label}</div>
                      <div className="mctb-recovery-outcome__helper">{opt.helper}</div>
                    </div>
                    <span className="mctb-recovery-check" aria-hidden>
                      {triggers[opt.key] ? "✓" : ""}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[12px] text-[#626872] leading-relaxed">
                These settings determine which call outcomes create a recovery event. Consent and
                messaging eligibility are checked separately before any text is sent.
              </p>
            </section>

            <section className="mctb-recovery-module" aria-labelledby="mctb-rec-repeat">
              <div className="mctb-recovery-module__head">
                <div className="mctb-recovery-module__icon">
                  <Repeat className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h3 id="mctb-rec-repeat" className="mctb-recovery-module__title">
                    Repeat callers
                  </h3>
                  <p className="mctb-recovery-module__desc">
                    Prevent the same caller from receiving repeated recovery texts too frequently.
                  </p>
                </div>
              </div>
              <div className="mctb-recovery-cooldown-grid">
                <div>
                  <span className="text-[12px] font-semibold text-[#3a3f47]">
                    Recovery cooldown
                  </span>
                  <p className="text-[12px] text-[#8b939e] mb-2">
                    After a recovery attempt, wait:
                  </p>
                  <div className="mctb-recovery-seg" role="group" aria-label="Cooldown duration">
                    {COOLDOWN_PRESETS_MINUTES.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className="mctb-recovery-seg-btn"
                        aria-pressed={!cooldownCustom && cooldownMinutes === m}
                        onClick={() => {
                          setCooldownCustom(false);
                          setCooldownMinutes(m);
                          setSaved(false);
                        }}
                      >
                        {cooldownPresetLabel(m)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="mctb-recovery-seg-btn"
                      aria-pressed={cooldownCustom}
                      onClick={() => setCooldownCustom(true)}
                    >
                      Custom
                    </button>
                  </div>
                  {cooldownCustom ? (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        className="h-9 w-24 rounded-lg border border-[#dee2e6] px-2 text-[13px]"
                        value={cooldownMinutes}
                        onChange={(e) => {
                          setCooldownMinutes(Math.max(0, Number(e.target.value) || 0));
                          setSaved(false);
                        }}
                        aria-label="Custom cooldown minutes"
                      />
                      <span className="text-[12px] text-[#626872]">minutes</span>
                    </div>
                  ) : null}
                  <div className="mt-4 space-y-2 text-[12.5px] text-[#3a3f47]">
                    <div className="mctb-recovery-row" style={{ border: "none", padding: 0 }}>
                      <span>Repeat caller during cooldown</span>
                      <span className="font-semibold">Suppress duplicate recovery</span>
                    </div>
                    <div className="mctb-recovery-row" style={{ border: "none", padding: 0 }}>
                      <span>After cooldown expires</span>
                      <span className="font-semibold">Allow new recovery</span>
                    </div>
                    <div className="mctb-recovery-row" style={{ border: "none", padding: 0 }}>
                      <span>Max texts per caller (window)</span>
                      <span className="font-semibold">{maxMessages}</span>
                    </div>
                  </div>
                </div>
                <div className="mctb-recovery-mini-flow" aria-hidden>
                  <div className="mctb-recovery-mini-flow__step">Caller misses call · 10:00 AM</div>
                  <div className="mctb-recovery-mini-flow__arrow">↓</div>
                  <div className="mctb-recovery-mini-flow__step">Recovery sent</div>
                  <div className="mctb-recovery-mini-flow__arrow">↓</div>
                  <div className="mctb-recovery-mini-flow__step">Caller calls again · 10:12 AM</div>
                  <div className="mctb-recovery-mini-flow__arrow">↓</div>
                  <div className="mctb-recovery-mini-flow__step font-semibold text-[#8a5a12]">
                    Suppressed — cooldown active
                  </div>
                </div>
              </div>
            </section>

            <section className="mctb-recovery-module" aria-labelledby="mctb-rec-guard">
              <h3 id="mctb-rec-guard" className="mctb-recovery-module__title mb-3">
                Recovery guardrails
              </h3>
              <button
                type="button"
                className="mctb-recovery-guard-row"
                onClick={() => {
                  setDelayDraft(delaySeconds);
                  setDelayModalOpen(true);
                }}
              >
                <span className="text-[#626872]">Recovery delay</span>
                <span className="font-semibold text-[#1b1e23]">
                  {formatDelayLabel(delaySeconds)} ›
                </span>
              </button>
              <div className="mctb-recovery-guard-row" style={{ cursor: "default" }}>
                <span className="text-[#626872]">Follow-up recovery</span>
                <Link href={MCTB_ROUTES.setupTextBack} className="font-semibold text-[#1b1e23]">
                  {followUpEnabled ? "On" : "Off"} ›
                </Link>
              </div>
              <div className="mctb-recovery-guard-row" style={{ cursor: "default" }}>
                <span className="text-[#626872]">Maximum recovery attempts</span>
                <span className="font-semibold text-[#1b1e23]">{maxMessages}</span>
              </div>
              <div className="mctb-recovery-guard-row" style={{ cursor: "default" }}>
                <span className="text-[#626872]">After-hours behavior</span>
                <span className="font-semibold text-[#1b1e23]">{scheduleModeLabel}</span>
              </div>
            </section>

            <section className="mctb-recovery-module" aria-labelledby="mctb-rec-why">
              <div className="mctb-recovery-module__head">
                <div className="mctb-recovery-module__icon">
                  <Shield className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h3 id="mctb-rec-why" className="mctb-recovery-module__title">
                    Why a caller may not receive a text
                  </h3>
                  <p className="mctb-recovery-module__desc">
                    Explanatory reference — matches runtime suppression codes.
                  </p>
                </div>
              </div>
              {SUPPRESSION_EXPLAINERS.map((row) => (
                <div key={row.code} className="mctb-recovery-reason">
                  <span className="mctb-recovery-reason__label">{row.label}</span>
                  <span className="mctb-recovery-reason__detail">{row.detail}</span>
                </div>
              ))}
            </section>
          </div>

          <aside className="mctb-recovery-rail" aria-label="Recovery summary">
            <div className="mctb-recovery-module">
              <h4 className="mctb-recovery-module__title mb-2">Recovery summary</h4>
              <div className="mctb-recovery-row">
                <span className="mctb-recovery-row__label">Status</span>
                <span className="mctb-recovery-row__value">{paused ? "Paused" : "Active"}</span>
              </div>
              <div className="mctb-recovery-row">
                <span className="mctb-recovery-row__label">Qualifying outcomes</span>
                <span className="mctb-recovery-row__value">{formatTriggerSummary(triggers)}</span>
              </div>
              <div className="mctb-recovery-row">
                <span className="mctb-recovery-row__label">Cooldown</span>
                <span className="mctb-recovery-row__value">{cooldownPresetLabel(cooldownMinutes)}</span>
              </div>
              <div className="mctb-recovery-row">
                <span className="mctb-recovery-row__label">Repeat callers</span>
                <span className="mctb-recovery-row__value">Suppressed during cooldown</span>
              </div>
              <div className="mctb-recovery-row">
                <span className="mctb-recovery-row__label">Consent</span>
                <span className="mctb-recovery-row__value">{consentSummary(consentMode)}</span>
              </div>
              <div className="mctb-recovery-row">
                <span className="mctb-recovery-row__label">Text-back</span>
                <span className="mctb-recovery-row__value">
                  {messagePreview ? "Configured" : "Not set"}
                </span>
              </div>
              <div className="mctb-recovery-row">
                <span className="mctb-recovery-row__label">Voicemail fallback</span>
                <span className="mctb-recovery-row__value">{voicemailReady ? "Ready" : "Configure"}</span>
              </div>
              <div className="mctb-recovery-row">
                <span className="mctb-recovery-row__label">Last recovery</span>
                <span className="mctb-recovery-row__value">
                  {lastRecoveryAt ? formatCompactWhen(lastRecoveryAt) : "—"}
                </span>
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <Link href={MCTB_ROUTES.setupConsent} className="mctb-recovery-link">
                  Edit Consent →
                </Link>
                <Link href={MCTB_ROUTES.setupTextBack} className="mctb-recovery-link">
                  Edit Text Back →
                </Link>
                <Link href={MCTB_ROUTES.setupVoicemail} className="mctb-recovery-link">
                  Edit Voicemail →
                </Link>
              </div>
              {messagePreview ? (
                <p className="mt-3 text-[12px] text-[#626872] truncate" title={messagePreview}>
                  Preview: “{messagePreview.slice(0, 72)}
                  {messagePreview.length > 72 ? "…" : ""}”
                </p>
              ) : null}
            </div>

            <div className="mctb-recovery-module">
              <h4 className="mctb-recovery-module__title mb-2">How recovery works</h4>
              <div className="mctb-recovery-flow">
                {[
                  "Missed call",
                  "Outcome qualifies",
                  "Recovery enabled",
                  "Cooldown checked",
                  "Consent checked",
                  "Message eligibility checked",
                  "Recovery text sent",
                ].map((step, i) => {
                  const highlight = i >= 1 && i <= 3;
                  return (
                    <div key={step}>
                      {i > 0 ? <div className="mctb-recovery-flow__arrow">↓</div> : null}
                      <div
                        className={`mctb-recovery-flow__step${highlight ? " mctb-recovery-flow__step--highlight" : ""}`}
                      >
                        {step}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mctb-recovery-module">
              <h4 className="mctb-recovery-module__title mb-2">Recent suppressed recoveries</h4>
              {recentSuppressions.length === 0 ? (
                <p className="text-[12.5px] text-[#626872]">No suppressed events in the last 7 days.</p>
              ) : (
                recentSuppressions.map((row, i) => (
                  <div key={`${row.phone}-${i}`} className="mctb-recovery-suppression-item">
                    <div>
                      <div className="font-semibold text-[#1b1e23]">{row.phone}</div>
                      <div className="text-[#8b939e]">{row.reason}</div>
                    </div>
                    <div className="text-[#626872] shrink-0">{row.time}</div>
                  </div>
                ))
              )}
              <Link
                href={`${MCTB_ROUTES.missedCalls}?status=suppressed&date=7d`}
                className="mctb-recovery-link mt-2 inline-block"
              >
                View missed calls →
              </Link>
            </div>

            <Link
              href={MCTB_ROUTES.setupTest}
              className="mctb-recovery-module flex items-center justify-between text-[13px] font-semibold text-[#1b1e23]"
            >
              Run connection test
              <ChevronRight className="h-4 w-4 text-[#8b939e]" aria-hidden />
            </Link>
          </aside>
        </div>
      </div>

      {pauseOpen ? (
        <div className="mctb-recovery-modal-backdrop" role="presentation" onClick={() => setPauseOpen(false)}>
          <div
            className="mctb-recovery-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mctb-pause-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="mctb-pause-title">Pause recovery</h2>
            <p className="mt-2 text-[13px] text-[#626872] leading-relaxed">
              Calls will continue to forward and voicemail will continue to work. Automatic recovery
              texts will pause until the selected time.
            </p>
            <p className="mt-2 text-[12px] text-[#8b939e]">Timezone: {timezone}</p>
            <label>
              <input
                type="radio"
                name="pause-rec"
                checked={pauseChoice === "1h"}
                onChange={() => setPauseChoice("1h")}
              />
              1 hour
            </label>
            <label>
              <input
                type="radio"
                name="pause-rec"
                checked={pauseChoice === "tomorrow"}
                onChange={() => setPauseChoice("tomorrow")}
              />
              Until tomorrow morning
            </label>
            <label>
              <input
                type="radio"
                name="pause-rec"
                checked={pauseChoice === "24h"}
                onChange={() => setPauseChoice("24h")}
              />
              24 hours
            </label>
            <label>
              <input
                type="radio"
                name="pause-rec"
                checked={pauseChoice === "custom"}
                onChange={() => setPauseChoice("custom")}
              />
              Custom date &amp; time
            </label>
            {pauseChoice === "custom" ? (
              <input
                type="datetime-local"
                className="mt-1 w-full rounded border border-[#dee2e6] px-2 py-1.5 text-[13px]"
                value={pauseCustomAt}
                onChange={(e) => setPauseCustomAt(e.target.value)}
              />
            ) : null}
            <label>
              <input
                type="radio"
                name="pause-rec"
                checked={pauseChoice === "manual"}
                onChange={() => setPauseChoice("manual")}
              />
              Until I resume it
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--outline"
                onClick={() => setPauseOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary"
                disabled={pauseBusy || (pauseChoice === "custom" && !pauseCustomAt)}
                onClick={() => void confirmPause()}
              >
                Pause recovery
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {delayModalOpen ? (
        <div
          className="mctb-recovery-modal-backdrop"
          role="presentation"
          onClick={() => setDelayModalOpen(false)}
        >
          <div
            className="mctb-recovery-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mctb-delay-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="mctb-delay-title">Recovery delay</h2>
            <p className="mt-2 text-[13px] text-[#626872]">
              Wait before sending the recovery text after a qualifying missed call.
            </p>
            <input
              type="number"
              min={0}
              max={120}
              className="mt-3 w-full rounded border border-[#dee2e6] px-2 py-2 text-[13px]"
              value={delayDraft}
              onChange={(e) => setDelayDraft(Math.max(0, Number(e.target.value) || 0))}
            />
            <span className="text-[12px] text-[#8b939e]"> seconds (0 = immediately)</span>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--outline"
                onClick={() => setDelayModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary"
                onClick={() => {
                  setDelaySeconds(delayDraft);
                  setDelayModalOpen(false);
                  setSaved(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </MctbSetupShell>
  );
}
