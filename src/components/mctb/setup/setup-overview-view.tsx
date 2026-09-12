"use client";

import { MctbSetupPauseControl } from "@/components/mctb/setup/mctb-setup-pause-control";
import {
  SetupOverviewFlowStrip,
  SetupOverviewGroupHead,
  SetupOverviewQuickActions,
  SetupOverviewSummaryRowLink,
} from "@/components/mctb/setup/setup-overview-premium";
import "./setup-overview-visual.css";
import { MctbSetupShell } from "@/components/mctb/setup/mctb-setup-shell";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import type { MctbForwardingCarrier } from "@/lib/mctb/onboarding/types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  buildSetupActivityFromFunnel,
  buildSetupAttentionItems,
  buildCoreSystemsReadiness,
  buildSetupFlowStages,
  buildSetupGlobalStatus,
  buildSetupSummaryRows,
  formatShortWhenCompact,
} from "@/lib/mctb/setup-overview-model";
import { AlertTriangle, Check, Settings2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SetupApi = {
  runtime: {
    enabled: boolean;
    phoneNumberId: string | null;
    smsPhoneNumberId?: string | null;
    messageTemplate: string;
    sendAfterNoAnswer: boolean;
    sendAfterBusy: boolean;
    sendAfterRejected: boolean;
    sendAfterTimeout: boolean;
    cooldownMinutes: number;
    timezone?: string;
    replyNotifications?: boolean;
  };
  schedule: {
    paused: boolean;
    pauseUntil?: string | null;
    pauseKind?: "manual" | "timed" | null;
  };
  consentMode: MctbConsentMode;
  businessLineE164?: string | null;
  productionForwardTargetE164?: string | null;
  phoneNumbers: Array<{ id: string; e164: string; label?: string | null }>;
  compliance: { messagingReady: boolean; requiredActions: string[] };
};

export function MctbSetupOverviewView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [setup, setSetup] = useState<SetupApi | null>(null);
  const [exclusionCount, setExclusionCount] = useState(0);
  const [notificationSummary, setNotificationSummary] = useState("Not loaded");
  const [voicemailSummary, setVoicemailSummary] = useState("Configure in Voicemail");
  const [voicemailTranscriptionOn, setVoicemailTranscriptionOn] = useState<boolean | undefined>();
  const [forwardingVerified, setForwardingVerified] = useState(false);
  const [forwardingCarrier, setForwardingCarrier] = useState<MctbForwardingCarrier | null>(null);
  const [forwardingRingSeconds, setForwardingRingSeconds] = useState<number | null>(null);
  const [lastTestAt, setLastTestAt] = useState<string | null>(null);
  const [liveTestPassed, setLiveTestPassed] = useState(false);
  const [funnelEvents, setFunnelEvents] = useState<Record<string, string>>({});
  const [showAllIssues, setShowAllIssues] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [setupRes, overviewRes, exclRes, handoffRes, onboardRes, liveRes] = await Promise.all([
        fetch("/api/mctb/setup", { cache: "no-store" }),
        fetch("/api/mctb/overview", { cache: "no-store" }),
        fetch("/api/mctb/exclusions", { cache: "no-store" }),
        fetch("/api/mctb/handoff", { cache: "no-store" }),
        fetch("/api/mctb/onboarding", { cache: "no-store" }),
        fetch("/api/mctb/live-test", { cache: "no-store" }),
      ]);

      const setupJson = await setupRes.json();
      if (!setupRes.ok || !setupJson.data) throw new Error("setup");

      const data = setupJson.data as SetupApi;
      setSetup(data);

      if (exclRes.ok) {
        const ex = await exclRes.json();
        const rows = Array.isArray(ex.data) ? ex.data : ex.exclusions;
        setExclusionCount(Array.isArray(rows) ? rows.length : 0);
      }

      if (handoffRes.ok) {
        const h = await handoffRes.json();
        const recipients = (h.data?.recipients || []) as Array<{
          enabled?: boolean;
          email?: string | null;
          mobileE164?: string | null;
          eventChannels?: Record<string, { email?: boolean; sms?: boolean }>;
        }>;
        const active = recipients.filter((r) => r.enabled !== false);
        const emailOn = active.some(
          (r) =>
            Boolean(r.email) &&
            Object.values(r.eventChannels || {}).some((ch) => ch?.email),
        );
        const smsOn = active.some(
          (r) =>
            Boolean(r.mobileE164) &&
            Object.values(r.eventChannels || {}).some((ch) => ch?.sms),
        );
        if (active.length === 0) setNotificationSummary("No recipients configured");
        else
          setNotificationSummary(
            `${emailOn ? "Email on" : "Email off"} · ${smsOn ? "SMS on" : "SMS off"}`,
          );
      } else {
        setNotificationSummary("Unable to load notifications");
      }

      if (onboardRes.ok) {
        const ob = await onboardRes.json();
        setForwardingVerified(Boolean(ob.state?.forwardingConnectedAt || ob.forwardingVerification?.verified));
        setFunnelEvents(ob.state?.funnelEvents || {});
        if (ob.state?.forwardingCarrier) setForwardingCarrier(ob.state.forwardingCarrier);
        if (ob.state?.forwardingRingSeconds != null) setForwardingRingSeconds(ob.state.forwardingRingSeconds);
        if (ob.state?.liveTestPassedAt) {
          setLastTestAt(ob.state.liveTestPassedAt as string);
          setLiveTestPassed(true);
        }
      }

      if (liveRes.ok) {
        const live = await liveRes.json();
        if (live.data?.passed) setLiveTestPassed(true);
      }

      const phoneId = data.runtime.phoneNumberId;
      if (phoneId) {
        const vmRes = await fetch(`/api/phone/voicemail?phoneNumberId=${encodeURIComponent(phoneId)}`, {
          cache: "no-store",
        });
        if (vmRes.ok) {
          const vm = await vmRes.json();
          const box = vm.box || vm.data?.box;
          const greetingText = box?.greetingText?.trim();
          const greetingUrl = box?.greetingUrl?.trim();
          if (greetingText || greetingUrl) setVoicemailSummary("Custom greeting · Active");
          else setVoicemailSummary("Default greeting");
          if (typeof box?.transcriptionEnabled === "boolean") {
            setVoicemailTranscriptionOn(box.transcriptionEnabled);
          }
        }
      }

      if (overviewRes.ok) {
        const ov = await overviewRes.json();
        if (ov.data?.setupHealth?.forwardingLabel === "Verified") {
          setForwardingVerified(true);
        }
      }
    } catch {
      setError(true);
      setSetup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const triggersOn = useMemo(() => {
    if (!setup) return false;
    const r = setup.runtime;
    return r.sendAfterNoAnswer || r.sendAfterBusy || r.sendAfterRejected || r.sendAfterTimeout;
  }, [setup]);

  const globalStatus = useMemo(() => {
    if (!setup) return null;
    return buildSetupGlobalStatus({
      runtime: setup.runtime,
      schedule: setup.schedule,
      businessLineE164: setup.businessLineE164,
      phoneNumbers: setup.phoneNumbers,
      forwardingVerified,
      messagingReady: setup.compliance.messagingReady,
      lastTestAt,
    });
  }, [setup, forwardingVerified, lastTestAt]);

  const attention = useMemo(() => {
    if (!setup) return [];
    return buildSetupAttentionItems({
      forwardingVerified,
      messagingReady: setup.compliance.messagingReady,
      requiredActions: setup.compliance.requiredActions,
      triggersOn,
      consentMode: setup.consentMode,
      existingConsentBlocked:
        setup.consentMode === "existing_consent" && !setup.compliance.messagingReady,
      voicemailConfigured: !voicemailSummary.includes("Not") && voicemailSummary !== "Configure in Voicemail",
    });
  }, [setup, forwardingVerified, triggersOn, voicemailSummary]);

  const rows = useMemo(() => {
    if (!setup) return [];
    return buildSetupSummaryRows({
      runtime: setup.runtime,
      schedule: setup.schedule,
      consentMode: setup.consentMode,
      businessLineE164: setup.businessLineE164,
      forwardTargetE164: setup.productionForwardTargetE164,
      forwardingVerified,
      forwardingCarrier,
      forwardingRingSeconds,
      messagingReady: setup.compliance.messagingReady,
      exclusionCount,
      lastTestAt,
      liveTestPassed,
      notificationSummary,
      voicemailSummary,
      voicemailTranscriptionOn,
      existingConsentBlocked:
        setup.consentMode === "existing_consent" && !setup.compliance.messagingReady,
    });
  }, [
    setup,
    forwardingVerified,
    forwardingCarrier,
    forwardingRingSeconds,
    exclusionCount,
    lastTestAt,
    liveTestPassed,
    notificationSummary,
    voicemailSummary,
    voicemailTranscriptionOn,
  ]);

  const callFlowRows = rows.filter((r) => r.group === "call-flow");
  const operationsRows = rows.filter((r) => r.group === "operations");

  const flowStages = useMemo(() => {
    if (!setup) return [];
    const paused = setup.schedule.paused || !setup.runtime.enabled;
    return buildSetupFlowStages({
      consentMode: setup.consentMode,
      forwardingVerified,
      recoveryPaused: paused,
      recoveryActive: triggersOn && !paused,
      voicemailReady: !voicemailSummary.includes("Not") && voicemailSummary !== "Configure in Voicemail",
    });
  }, [setup, forwardingVerified, triggersOn, voicemailSummary]);

  const activity = useMemo(() => buildSetupActivityFromFunnel(funnelEvents), [funnelEvents]);

  const navAttention = useMemo(() => {
    const s = new Set<string>();
    if (attention.some((a) => a.id === "forwarding" || a.id === "messaging")) s.add("phone");
    if (attention.some((a) => a.id === "triggers")) s.add("recovery");
    if (attention.some((a) => a.id === "consent-sender")) s.add("consent");
    if (attention.some((a) => a.id === "voicemail")) s.add("voicemail");
    return s;
  }, [attention]);

  const headerMeta = lastTestAt ? (
    <span>
      Last successful test
      <br />
      {formatShortWhenCompact(lastTestAt)}
    </span>
  ) : null;

  const headerAction = (
    <Link href={MCTB_ROUTES.setupTest} className="mctb-setup-btn mctb-setup-btn--primary">
      Run live test
    </Link>
  );

  const shellProps = {
    title: "Setup",
    description:
      "Configure missed-call recovery, forwarding, consent, voicemail, and operational controls.",
    headerIcon: <Settings2 className="h-4 w-4" strokeWidth={1.75} aria-hidden />,
    headerMeta,
    headerAction,
    navAttention,
  };

  if (loading) {
    return (
      <MctbSetupShell {...shellProps}>
        <div className="mctb-setup-canvas">
          <div className="mctb-setup-span-12 mctb-setup-skel h-16" />
          <div className="mctb-setup-span-12 mctb-setup-skel h-12" />
          <div className="mctb-setup-span-12 mctb-setup-skel h-20" />
          <div className="mctb-setup-span-12 mctb-setup-skel h-80" />
        </div>
      </MctbSetupShell>
    );
  }

  if (error || !setup || !globalStatus) {
    return (
      <MctbSetupShell {...shellProps}>
        <div className="mctb-setup-panel mctb-setup-span-12">
          <p className="text-[13px]">Unable to load setup status.</p>
          <button type="button" className="mctb-setup-btn mctb-setup-btn--outline mt-3" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </MctbSetupShell>
    );
  }

  const senderParts = globalStatus.senderLabel?.split(" · ") ?? [];
  const senderNumber = senderParts[0] || "—";
  const senderState = senderParts[1] || "—";
  const recoveryActive = !globalStatus.paused && setup.runtime.enabled;
  const visibleAttention = showAllIssues ? attention : attention.slice(0, 2);
  const messageConfigured = setup.runtime.messageTemplate.trim().length > 0;
  const voicemailReady =
    !voicemailSummary.includes("Not") && voicemailSummary !== "Configure in Voicemail";
  const coreReadiness = buildCoreSystemsReadiness({
    forwardingVerified,
    messagingReady: setup.compliance.messagingReady,
    recoveryPaused: globalStatus.paused,
    triggersOn,
    messageConfigured,
    voicemailReady,
  });

  const lastTestParts = lastTestAt ? formatShortWhenCompact(lastTestAt).split(", ") : null;

  return (
    <MctbSetupShell {...shellProps}>
      <div className="mctb-setup-canvas">
        <div className="mctb-setup-span-12 mctb-setup-status-rail">
          <div className="mctb-setup-status-rail__lead-col">
            <span className="mctb-setup-status-rail__kicker">Recovery</span>
            <span
              className={`mctb-setup-status-rail__state${
                recoveryActive
                  ? " mctb-setup-status-rail__state--active"
                  : " mctb-setup-status-rail__state--paused"
              }`}
            >
              {recoveryActive ? "Active" : globalStatus.paused ? "Paused" : "Inactive"}
            </span>
          </div>
          <div className="mctb-setup-status-rail__meta">
            <div className="mctb-setup-status-rail__item">
              <span className="mctb-setup-status-rail__item-label">Business line</span>
              <span className="mctb-setup-status-rail__item-value">
                {globalStatus.businessLineLabel || "Not set"}
              </span>
            </div>
            <div className="mctb-setup-status-rail__item">
              <span className="mctb-setup-status-rail__item-label">Text-back sender</span>
              <span className="mctb-setup-status-rail__item-value">{senderNumber}</span>
              <span className="mctb-setup-status-rail__item-sublabel">{senderState}</span>
            </div>
            <div className="mctb-setup-status-rail__item">
              <span className="mctb-setup-status-rail__item-label">Forwarding</span>
              <span className="mctb-setup-status-rail__item-value">
                {forwardingVerified ? "Verified" : "Pending"}
              </span>
            </div>
            <div className="mctb-setup-status-rail__item">
              <span className="mctb-setup-status-rail__item-label">Last test</span>
              <span className="mctb-setup-status-rail__item-value">
                {lastTestParts?.[0] || "Never"}
              </span>
              {lastTestParts?.[1] ? (
                <span className="mctb-setup-status-rail__item-sublabel">{lastTestParts[1]}</span>
              ) : null}
            </div>
          </div>
          <div className="mctb-setup-status-rail__actions">
            <MctbSetupPauseControl
              paused={globalStatus.paused}
              pauseUntil={globalStatus.pauseUntil}
              pauseKind={globalStatus.pauseKind}
              timezone={setup.runtime.timezone || "America/New_York"}
              onUpdated={() => void load()}
            />
          </div>
        </div>

        <div
          className={`mctb-setup-span-12 mctb-setup-health-strip${
            attention.length > 0 ? " mctb-setup-health-strip--warn" : " mctb-setup-health-strip--ok"
          }`}
          role="status"
        >
          <div className="mctb-setup-health-strip__left">
            <span className="mctb-setup-health-strip__icon" aria-hidden>
              {attention.length > 0 ? (
                <AlertTriangle className="h-3 w-3" strokeWidth={2.25} />
              ) : (
                <Check className="h-3 w-3" strokeWidth={2.5} />
              )}
            </span>
            <div>
              <div className="mctb-setup-health-strip__title">
                {attention.length > 0 ? "Needs attention" : "Setup healthy"}
              </div>
              <div className="mctb-setup-health-strip__sub">
                {attention.length > 0
                  ? attention[0]?.message
                  : "All required recovery services are ready."}
              </div>
            </div>
          </div>
          <span className="mctb-setup-health-strip__count">
            {coreReadiness.ready} of {coreReadiness.total} core systems ready
          </span>
        </div>

        {attention.length > 0 ? (
          <div className="mctb-setup-span-12 mctb-setup-attention mctb-setup-attention--warn" role="status">
            {visibleAttention.map((item) => (
              <div key={item.id} className="mctb-setup-attention-row">
                <span className="flex items-center gap-2 text-[12px]">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#8a6116]" aria-hidden />
                  {item.message}
                </span>
                <Link href={item.href}>{item.actionLabel}</Link>
              </div>
            ))}
            {attention.length > 2 && !showAllIssues ? (
              <button
                type="button"
                className="text-left text-[12px] font-semibold text-[#1b1e23] underline"
                onClick={() => setShowAllIssues(true)}
              >
                View {attention.length} issues
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="mctb-setup-span-12">
          <SetupOverviewFlowStrip stages={flowStages} />
        </div>

        <div className="mctb-setup-span-12">
          <SetupOverviewGroupHead label="Call flow" />
          <div className="mctb-setup-summary">
            {callFlowRows.map((row) => (
              <SetupOverviewSummaryRowLink key={row.id} row={row} />
            ))}
          </div>
        </div>

        <div className="mctb-setup-span-12">
          <SetupOverviewGroupHead label="Operations" spaced />
          <div className="mctb-setup-summary">
            {operationsRows.map((row) => (
              <SetupOverviewSummaryRowLink key={row.id} row={row} />
            ))}
          </div>
        </div>

        {activity.length > 0 ? (
          <div className="mctb-setup-span-7 mctb-setup-panel mctb-setup-panel--level3">
            <h2>Recent system activity</h2>
            <ul className="mctb-setup-activity-timeline">
              {activity.map((ev) => (
                <li key={`${ev.label}-${ev.at}`} className="mctb-setup-activity-timeline__item">
                  <span
                    className={`mctb-setup-activity-timeline__dot${
                      ev.kind === "success" ? " mctb-setup-activity-timeline__dot--success" : ""
                    }`}
                    aria-hidden
                  />
                  <span className="mctb-setup-activity-timeline__label">{ev.label}</span>
                  <span className="mctb-setup-activity-timeline__time">
                    {formatShortWhenCompact(ev.at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mctb-setup-span-7" />
        )}

        <div className="mctb-setup-span-5">
          <SetupOverviewQuickActions />
        </div>
      </div>
    </MctbSetupShell>
  );
}
