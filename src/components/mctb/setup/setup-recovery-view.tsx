"use client";

import { MctbSetupShell } from "@/components/mctb/setup/mctb-setup-shell";
import "./mctb-setup-recovery.css";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { addPauseUntil } from "@/lib/mctb/schedule-shared";
import { formatCompactWhen } from "@/lib/mctb/setup-phone-forwarding-model";
import {
  aggregateSuppressionCounts,
  COOLDOWN_PRESETS_MINUTES,
  countActiveTriggers,
  cooldownFlowOutcomeLabel,
  cooldownPresetLabel,
  DIAGNOSTIC_REASONS_LEFT,
  DIAGNOSTIC_REASONS_RIGHT,
  formatCooldownDisplay,
  formatConsentRailValue,
  formatDelayLabel,
  formatRepeatCallerSummary,
  formatSuppressionRow,
  formatTriggerRailSummary,
  isCooldownOff,
  isCooldownPresetOrOff,
  recoverySnapshotsEqual,
  TRIGGER_OPTIONS,
  type RecoverySnapshot,
  type TriggerKey,
  type TriggerState,
} from "@/lib/mctb/setup-recovery-model";
import {
  Activity,
  Check,
  ChevronRight,
  Clock,
  History,
  Info,
  MessageSquare,
  Phone,
  PhoneMissed,
  PhoneOff,
  Power,
  RefreshCw,
  Repeat,
  Shield,
  ShieldCheck,
  Signal,
  Voicemail,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MctbSetupBookingSection } from "@/components/mctb/setup/mctb-setup-booking-section";
import { MCTB_LAUNCH_HIDE_AI_BOOK_UI, MCTB_LAUNCH_SIMPLIFY_RECOVERY_UI } from "@/lib/mctb/launch-flags";

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

const TRIGGER_ICONS: Record<TriggerKey, LucideIcon> = {
  noAnswer: PhoneMissed,
  busy: Phone,
  rejected: PhoneOff,
  timeout: Signal,
  voicemail: Voicemail,
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
  const [forwardingVerified, setForwardingVerified] = useState(true);
  const [baseline, setBaseline] = useState<RecoverySnapshot | null>(null);
  const [recentSuppressions, setRecentSuppressions] = useState<
    Array<{ phone: string; reason: string; time: string }>
  >([]);
  const [suppressionCounts, setSuppressionCounts] = useState<Record<string, number>>({});
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
        fetch("/api/mctb/missed-calls?status=suppressed&date=7d&pageSize=50&sort=detectedAt_desc", {
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
      const cd = r.cooldownMinutes ?? 0;
      setCooldownCustom(!isCooldownPresetOrOff(cd));
      setDelaySeconds(r.delaySeconds ?? 0);
      setTimezone(r.timezone || "America/New_York");
      setSchedule({
        paused: Boolean(sch?.paused),
        pauseUntil: sch?.pauseUntil ?? null,
        pauseKind: sch?.pauseKind ?? null,
      });
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
        setSuppressionCounts(aggregateSuppressionCounts(rows));
        setRecentSuppressions(
          rows.slice(0, 5).map((e) =>
            formatSuppressionRow(e.callerE164, e.suppressionReason, e.detectedAt),
          ),
        );
      } else {
        setRecentSuppressions([]);
        setSuppressionCounts({});
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

  const consentRail = formatConsentRailValue(consentMode);
  const cooldownLabel = formatCooldownDisplay(cooldownMinutes);
  const repeatCallerLabel = formatRepeatCallerSummary(cooldownMinutes);
  const flowOutcomeLabel = cooldownFlowOutcomeLabel(cooldownMinutes);

  const recoveryFlowSteps = useMemo(
    () => [
      { label: "Missed call", owned: false },
      { label: "Outcome qualifies", owned: true },
      { label: paused ? "Recovery paused" : "Recovery active", owned: true },
      { label: isCooldownOff(cooldownMinutes) ? "Cooldown off" : "Cooldown passes", owned: true },
      { label: "Consent confirmed", owned: false },
      { label: "Recovery text", owned: false },
    ],
    [paused, cooldownMinutes],
  );

  function diagCount(code: string): number | null {
    const n = suppressionCounts[code];
    return n && n > 0 ? n : null;
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
    <div className="mctb-recovery-header-actions">
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
            <div className="mctb-recovery-section-header__icon" aria-hidden>
              <RefreshCw className="h-[18px] w-[18px]" strokeWidth={1.85} />
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
          className={`mctb-recovery-cmd-bar ${paused ? "mctb-recovery-cmd-bar--paused" : "mctb-recovery-cmd-bar--active"}`}
          role="status"
        >
          <div className="mctb-recovery-cmd-bar__state">
            <span
              className={`mctb-recovery-dot ${paused ? "mctb-recovery-dot--paused" : "mctb-recovery-dot--active"}`}
              aria-hidden
            />
            <span className="mctb-recovery-cmd-bar__value">
              {paused ? "Recovery paused" : "Recovery active"}
            </span>
          </div>
          {paused ? (
            <>
              {pauseLabel ? (
                <span className="mctb-recovery-cmd-bar__pause-note">{pauseLabel}. Forwarding and voicemail remain active.</span>
              ) : null}
              <button
                type="button"
                className="mctb-setup-btn mctb-setup-btn--primary mctb-recovery-cmd-bar__resume"
                disabled={pauseBusy}
                onClick={() => void resumeNow()}
              >
                Resume now
              </button>
            </>
          ) : (
            <>
              <div className="mctb-recovery-cmd-bar__seg">
                <span className="mctb-recovery-cmd-bar__label">Qualifying</span>
                <span className="mctb-recovery-cmd-bar__value">
                  {activeTriggers} {activeTriggers === 1 ? "outcome" : "outcomes"}
                </span>
              </div>
              <div className="mctb-recovery-cmd-bar__seg">
                <span className="mctb-recovery-cmd-bar__label">Cooldown</span>
                <span className="mctb-recovery-cmd-bar__value">{cooldownLabel}</span>
              </div>
              <div className="mctb-recovery-cmd-bar__seg">
                <span className="mctb-recovery-cmd-bar__label">Last recovery</span>
                <span className="mctb-recovery-cmd-bar__value">
                  {lastRecoveryAt ? formatCompactWhen(lastRecoveryAt) : "—"}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="mctb-recovery-grid">
          <div className="mctb-recovery-main">
            <section
              className="mctb-recovery-module mctb-recovery-module--elevated"
              aria-labelledby="mctb-rec-status"
            >
              <div className="mctb-recovery-status-compact">
                <div className="mctb-recovery-status-compact__left">
                  <div className="mctb-recovery-module__icon">
                    <Power className="h-4 w-4" aria-hidden />
                  </div>
                  <div>
                    <h3 id="mctb-rec-status" className="mctb-recovery-module__title">
                      Recovery status
                    </h3>
                    <p className="mctb-recovery-status-compact__state">
                      <span
                        className={`mctb-recovery-dot ${paused ? "mctb-recovery-dot--paused" : "mctb-recovery-dot--active"}`}
                        aria-hidden
                      />
                      {paused ? "Paused" : "Active"}
                    </p>
                    <p className="mctb-recovery-status-compact__helper">
                      {paused
                        ? "Automatic recovery texts are paused."
                        : "Missed-call recovery is running."}
                    </p>
                  </div>
                </div>
                <div className="mctb-recovery-status-compact__actions">
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
              </div>
              <p className="mctb-recovery-status-foot">
                Forwarding and voicemail stay active while recovery texting is paused.
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
                {TRIGGER_OPTIONS.map((opt) => {
                  const Icon = TRIGGER_ICONS[opt.key];
                  const on = triggers[opt.key];
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      className="mctb-recovery-outcome"
                      aria-pressed={on}
                      onClick={() => toggleTrigger(opt.key)}
                    >
                      <span className="mctb-recovery-outcome__icon" aria-hidden>
                        <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
                      </span>
                      <div className="mctb-recovery-outcome__main">
                        <div className="mctb-recovery-outcome__label">{opt.label}</div>
                        <div className="mctb-recovery-outcome__helper">{opt.helper}</div>
                      </div>
                      <span className="mctb-recovery-toggle" aria-hidden>
                        {on ? <Check strokeWidth={3} /> : null}
                      </span>
                    </button>
                  );
                })}
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
                    <button
                      type="button"
                      className="mctb-recovery-seg-btn"
                      aria-pressed={!cooldownCustom && isCooldownOff(cooldownMinutes)}
                      onClick={() => {
                        setCooldownCustom(false);
                        setCooldownMinutes(0);
                        setSaved(false);
                      }}
                    >
                      Off
                    </button>
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
                </div>
                <div className="mctb-recovery-mini-flow" aria-hidden>
                  <div className="mctb-recovery-mini-flow__row">
                    <span>Missed call</span>
                    <span>10:00 AM</span>
                  </div>
                  <div className="mctb-recovery-mini-flow__arrow">↓</div>
                  <div className="mctb-recovery-mini-flow__row">
                    <span>Recovery text sent</span>
                  </div>
                  <div className="mctb-recovery-mini-flow__arrow">↓</div>
                  <div className="mctb-recovery-mini-flow__row">
                    <span>Calls again</span>
                    <span>10:12 AM</span>
                  </div>
                  <div className="mctb-recovery-mini-flow__arrow">↓</div>
                  <div
                    className={`mctb-recovery-mini-flow__outcome ${isCooldownOff(cooldownMinutes) ? "mctb-recovery-mini-flow__outcome--ok" : "mctb-recovery-mini-flow__outcome--warn"}`}
                  >
                    {flowOutcomeLabel}
                  </div>
                </div>
              </div>
            </section>

            {MCTB_LAUNCH_SIMPLIFY_RECOVERY_UI ? (
              <section className="mctb-recovery-module mctb-recovery-module--elevated" aria-labelledby="mctb-rec-ai-lr">
                <h3 id="mctb-rec-ai-lr" className="mctb-recovery-module__title mb-1">
                  AI Recovery
                </h3>
                <p className="mctb-recovery-module__desc text-[13px] text-[#555] mb-3">
                  Configure what Transovo should know and collect when customers reply to recovery texts.
                </p>
                <Link href={MCTB_ROUTES.aiRecovery} className="mctb-recovery-link font-medium">
                  Configure AI Recovery →
                </Link>
              </section>
            ) : (
              <section className="mctb-recovery-module mctb-recovery-module--elevated" aria-labelledby="mctb-rec-ai-lr">
                <h3 id="mctb-rec-ai-lr" className="mctb-recovery-module__title mb-1">
                  AI Lead Recovery
                </h3>
                <p className="mctb-recovery-module__desc text-[13px] text-[#555] mb-3">
                  Configure how Transovo handles replies, booking, emergencies, payments, and handoff.
                </p>
                <Link href={MCTB_ROUTES.aiLeadRecovery} className="mctb-recovery-link font-medium">
                  Configure AI Lead Recovery →
                </Link>
              </section>
            )}

            {MCTB_LAUNCH_HIDE_AI_BOOK_UI ? null : <MctbSetupBookingSection />}

            <section className="mctb-recovery-module mctb-recovery-module--elevated" aria-labelledby="mctb-rec-guard">
              <h3 id="mctb-rec-guard" className="mctb-recovery-module__title mb-1">
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
              <div className="mctb-recovery-guard-row mctb-recovery-guard-row--static">
                <span className="text-[#626872]">Repeat caller behavior</span>
                <span className="font-semibold text-[#1b1e23]">
                  {isCooldownOff(cooldownMinutes) ? "Allow immediately" : "Allow after cooldown"}
                </span>
              </div>
            </section>

            <section className="mctb-recovery-module mctb-recovery-module--elevated" aria-labelledby="mctb-rec-why">
              <div className="mctb-recovery-module__head">
                <div className="mctb-recovery-module__icon">
                  <Info className="h-4 w-4" aria-hidden />
                </div>
                <div>
                  <h3 id="mctb-rec-why" className="mctb-recovery-module__title">
                    Why a recovery may not send
                  </h3>
                  <p className="mctb-recovery-module__desc">
                    A missed call can qualify without ultimately sending a recovery text.
                  </p>
                </div>
              </div>
              <div className="mctb-recovery-diag-grid">
                <div>
                  {DIAGNOSTIC_REASONS_LEFT.map((row) => {
                    const c = diagCount(row.code);
                    return (
                      <div key={row.code} className="mctb-recovery-diag-item">
                        <span className="mctb-recovery-diag-item__left">
                          <Shield className="h-3.5 w-3.5 opacity-60" aria-hidden />
                          {row.label}
                        </span>
                        {c != null ? <span className="mctb-recovery-diag-item__count">{c}</span> : null}
                      </div>
                    );
                  })}
                </div>
                <div>
                  {DIAGNOSTIC_REASONS_RIGHT.map((row) => {
                    const c = diagCount(row.code);
                    return (
                      <div key={row.code} className="mctb-recovery-diag-item">
                        <span className="mctb-recovery-diag-item__left">
                          <Shield className="h-3.5 w-3.5 opacity-60" aria-hidden />
                          {row.label}
                        </span>
                        {c != null ? <span className="mctb-recovery-diag-item__count">{c}</span> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <Link
                href={`${MCTB_ROUTES.missedCalls}?status=suppressed&date=7d`}
                className="mctb-recovery-link mt-3 inline-block"
              >
                View missed calls →
              </Link>
            </section>
          </div>

          <aside className="mctb-recovery-rail" aria-label="Recovery summary">
            <div className="mctb-recovery-rail-panel mctb-recovery-module--elevated">
              <h4 className="mctb-recovery-rail-panel__title">Recovery summary</h4>
              <div className="mctb-recovery-summary-row">
                <span className="mctb-recovery-summary-row__left">
                  <Activity className="h-3.5 w-3.5" aria-hidden />
                  Status
                </span>
                <span className="mctb-recovery-summary-row__value">
                  <span className="mctb-recovery-status-pill">
                    {!paused ? <span className="mctb-recovery-status-pill__dot" aria-hidden /> : null}
                    {paused ? "Paused" : "Active"}
                  </span>
                </span>
              </div>
              <div className="mctb-recovery-summary-row">
                <span className="mctb-recovery-summary-row__left">
                  <PhoneMissed className="h-3.5 w-3.5" aria-hidden />
                  Qualifying outcomes
                </span>
                <span className="mctb-recovery-summary-row__value">{formatTriggerRailSummary(triggers)}</span>
              </div>
              <div className="mctb-recovery-summary-row">
                <span className="mctb-recovery-summary-row__left">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  Cooldown
                </span>
                <span className="mctb-recovery-summary-row__value">{cooldownLabel}</span>
              </div>
              <div className="mctb-recovery-summary-row">
                <span className="mctb-recovery-summary-row__left">
                  <Repeat className="h-3.5 w-3.5" aria-hidden />
                  Repeat callers
                </span>
                <span className="mctb-recovery-summary-row__value">{repeatCallerLabel}</span>
              </div>
              <div className="mctb-recovery-summary-row">
                <span className="mctb-recovery-summary-row__left">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  Consent
                </span>
                <span className="mctb-recovery-summary-row__value">
                  {consentRail.primary}
                  <span className="mctb-recovery-summary-row__sub">{consentRail.secondary}</span>
                </span>
              </div>
              <div className="mctb-recovery-summary-row">
                <span className="mctb-recovery-summary-row__left">
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  Text-back
                </span>
                <span className="mctb-recovery-summary-row__value">
                  {messagePreview ? "Configured" : "Not set"}
                </span>
              </div>
              <div className="mctb-recovery-summary-row">
                <span className="mctb-recovery-summary-row__left">
                  <History className="h-3.5 w-3.5" aria-hidden />
                  Last recovery
                </span>
                <span className="mctb-recovery-summary-row__value">
                  {lastRecoveryAt ? formatCompactWhen(lastRecoveryAt) : "—"}
                </span>
              </div>

              {messagePreview ? (
                <div className="mctb-recovery-msg-preview">
                  <div className="mctb-recovery-msg-preview__label">Recovery message</div>
                  <p className="mctb-recovery-msg-preview__quote">“{messagePreview}”</p>
                  <Link href={MCTB_ROUTES.setupTextBack} className="mctb-recovery-msg-preview__link">
                    Edit message →
                  </Link>
                </div>
              ) : null}

              <div className="mctb-recovery-related">
                <div className="mctb-recovery-related__label">Related settings</div>
                <Link href={MCTB_ROUTES.setupConsent} className="mctb-recovery-related-row">
                  <span className="mctb-recovery-related-row__left">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#8b939e]" aria-hidden />
                    Consent
                  </span>
                  <span className="mctb-recovery-related-row__right">
                    {consentRail.primary}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Link>
                <Link href={MCTB_ROUTES.setupTextBack} className="mctb-recovery-related-row">
                  <span className="mctb-recovery-related-row__left">
                    <MessageSquare className="h-3.5 w-3.5 text-[#8b939e]" aria-hidden />
                    Text Back
                  </span>
                  <span className="mctb-recovery-related-row__right">
                    {messagePreview ? "Configured" : "Set up"}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Link>
                <Link href={MCTB_ROUTES.setupVoicemail} className="mctb-recovery-related-row">
                  <span className="mctb-recovery-related-row__left">
                    <Voicemail className="h-3.5 w-3.5 text-[#8b939e]" aria-hidden />
                    Voicemail
                  </span>
                  <span className="mctb-recovery-related-row__right">
                    {voicemailReady ? "Ready" : "Configure"}
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </Link>
              </div>
            </div>

            <div className="mctb-recovery-rail-panel">
              <h4 className="mctb-recovery-rail-panel__title">How recovery works</h4>
              <div className="mctb-recovery-flow">
                {recoveryFlowSteps.map((step, i) => (
                  <div key={step.label}>
                    {i > 0 ? <div className="mctb-recovery-flow__arrow">↓</div> : null}
                    <div
                      className={`mctb-recovery-flow__step${step.owned ? " mctb-recovery-flow__step--owned" : ""}`}
                    >
                      {step.owned ? <span className="mctb-recovery-flow__marker" aria-hidden /> : null}
                      {step.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mctb-recovery-rail-panel">
              <h4 className="mctb-recovery-rail-panel__title">Recent suppressions</h4>
              {recentSuppressions.length === 0 ? (
                <p className="mctb-recovery-empty-ok">
                  <Check className="h-3.5 w-3.5 text-[#1a7f5a]" aria-hidden />
                  No recent suppressed recoveries
                </p>
              ) : (
                recentSuppressions.slice(0, 5).map((row, i) => (
                  <div key={`${row.phone}-${i}`} className="mctb-recovery-suppression-item">
                    <div>
                      <div className="font-semibold text-[#1b1e23]">{row.phone}</div>
                      <div className="text-[#8b939e]">{row.reason}</div>
                    </div>
                    <div className="text-[#626872] shrink-0 text-[11px]">{row.time}</div>
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
