"use client";

import { MctbSetupPauseControl } from "@/components/mctb/setup/mctb-setup-pause-control";
import { MctbSetupShell } from "@/components/mctb/setup/mctb-setup-shell";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  buildSetupActivityFromFunnel,
  buildSetupAttentionItems,
  buildSetupGlobalStatus,
  buildSetupSummaryRows,
  type SetupOverviewSummaryRow,
} from "@/lib/mctb/setup-overview-model";
import { ChevronRight } from "lucide-react";
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

function chipClass(status: SetupOverviewSummaryRow["status"]) {
  if (status === "ok") return "mctb-setup-chip mctb-setup-chip--ok";
  if (status === "warning") return "mctb-setup-chip mctb-setup-chip--warning";
  if (status === "error") return "mctb-setup-chip mctb-setup-chip--error";
  return "mctb-setup-chip";
}

export function MctbSetupOverviewView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [setup, setSetup] = useState<SetupApi | null>(null);
  const [exclusionCount, setExclusionCount] = useState(0);
  const [notificationSummary, setNotificationSummary] = useState("Not loaded");
  const [voicemailSummary, setVoicemailSummary] = useState("Configure in Voicemail");
  const [forwardingVerified, setForwardingVerified] = useState(false);
  const [lastTestAt, setLastTestAt] = useState<string | null>(null);
  const [liveTestPassed, setLiveTestPassed] = useState(false);
  const [funnelEvents, setFunnelEvents] = useState<Record<string, string>>({});

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
            `${emailOn ? "Email enabled" : "Email disabled"} · ${smsOn ? "SMS enabled" : "SMS disabled"}`,
          );
      } else {
        setNotificationSummary("Unable to load notifications");
      }

      if (onboardRes.ok) {
        const ob = await onboardRes.json();
        setForwardingVerified(Boolean(ob.state?.forwardingConnectedAt || ob.forwardingVerification?.verified));
        setFunnelEvents(ob.state?.funnelEvents || {});
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
      messagingReady: setup.compliance.messagingReady,
      exclusionCount,
      lastTestAt,
      liveTestPassed,
      notificationSummary,
      voicemailSummary,
      existingConsentBlocked:
        setup.consentMode === "existing_consent" && !setup.compliance.messagingReady,
    });
  }, [
    setup,
    forwardingVerified,
    exclusionCount,
    lastTestAt,
    liveTestPassed,
    notificationSummary,
    voicemailSummary,
  ]);

  const activity = useMemo(() => buildSetupActivityFromFunnel(funnelEvents), [funnelEvents]);

  const navAttention = useMemo(() => {
    const s = new Set<string>();
    if (attention.some((a) => a.id === "forwarding" || a.id === "messaging")) s.add("phone");
    if (attention.some((a) => a.id === "triggers")) s.add("recovery");
    if (attention.some((a) => a.id === "consent-sender")) s.add("consent");
    if (attention.some((a) => a.id === "voicemail")) s.add("voicemail");
    return s;
  }, [attention]);

  const headerAction = (
    <Link href={MCTB_ROUTES.setupTest} className="mctb-setup-btn mctb-setup-btn--primary">
      Run live test
    </Link>
  );

  if (loading) {
    return (
      <MctbSetupShell title="Setup" description="Configure missed-call recovery and call handling." headerAction={headerAction}>
        <div className="mctb-setup-canvas">
          <div className="mctb-setup-span-12 mctb-setup-skel h-14" />
          <div className="mctb-setup-span-12 mctb-setup-skel h-12" />
          <div className="mctb-setup-span-12 mctb-setup-skel h-80" />
        </div>
      </MctbSetupShell>
    );
  }

  if (error || !setup || !globalStatus) {
    return (
      <MctbSetupShell title="Setup" description="Configure missed-call recovery and call handling." headerAction={headerAction}>
        <div className="mctb-setup-panel mctb-setup-span-12">
          <p className="text-[13px]">Unable to load setup status.</p>
          <button type="button" className="mctb-setup-btn mctb-setup-btn--outline mt-3" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </MctbSetupShell>
    );
  }

  return (
    <MctbSetupShell
      title="Setup"
      description="Configure missed-call recovery, forwarding, consent, voicemail, and operational controls."
      headerAction={headerAction}
      navAttention={navAttention}
    >
      <div className="mctb-setup-canvas">
        <div className="mctb-setup-span-12 mctb-setup-status-strip">
          <span>
            <strong>{globalStatus.recoveryLabel}</strong>
          </span>
          {globalStatus.businessLineLabel ? (
            <>
              <span className="mctb-setup-status-strip__sep">·</span>
              <span>{globalStatus.businessLineLabel}</span>
            </>
          ) : null}
          {globalStatus.senderLabel ? (
            <>
              <span className="mctb-setup-status-strip__sep">·</span>
              <span>{globalStatus.senderLabel}</span>
            </>
          ) : null}
          <span className="mctb-setup-status-strip__sep">·</span>
          <span>{globalStatus.forwardingLabel}</span>
          <span className="mctb-setup-status-strip__sep">·</span>
          <span>{globalStatus.lastTestLabel}</span>
          <div className="mctb-setup-status-strip__actions">
            <MctbSetupPauseControl
              paused={globalStatus.paused}
              pauseUntil={globalStatus.pauseUntil}
              pauseKind={globalStatus.pauseKind}
              timezone={setup.runtime.timezone || "America/New_York"}
              onUpdated={() => void load()}
            />
          </div>
        </div>

        {attention.length > 0 ? (
          <div className="mctb-setup-span-12 mctb-setup-attention" role="status">
            {attention.map((item) => (
              <div key={item.id} className="mctb-setup-attention-row">
                <span>{item.message}</span>
                <Link href={item.href}>{item.actionLabel}</Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="mctb-setup-span-12 mctb-setup-attention mctb-setup-attention--ok" role="status">
            <span>✓ Setup is healthy.</span>
          </div>
        )}

        <div className="mctb-setup-span-12 mctb-setup-summary">
          {rows.map((row) => (
            <Link key={row.id} href={row.href} className="mctb-setup-summary-row">
              <div className="mctb-setup-summary-row__main">
                <div className="mctb-setup-summary-row__title">{row.title}</div>
                <div className="mctb-setup-summary-row__summary">{row.summary}</div>
              </div>
              <span className={chipClass(row.status)}>{row.statusLabel}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#8b939e]" aria-hidden />
            </Link>
          ))}
        </div>

        <div className="mctb-setup-span-7 mctb-setup-panel">
          <h2>Recent system activity</h2>
          {activity.length === 0 ? (
            <p className="text-[12px] text-[#626872]">No recorded setup events in this workspace yet.</p>
          ) : (
            <ul className="list-none p-0 m-0">
              {activity.map((ev) => (
                <li key={`${ev.label}-${ev.at}`} className="mctb-setup-activity-row">
                  <span>{ev.label}</span>
                  <span className="text-[#8b939e]">
                    {new Date(ev.at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mctb-setup-span-5 mctb-setup-panel">
          <h2>Quick actions</h2>
          <Link href={MCTB_ROUTES.setupTest} className="mctb-setup-quick-action">
            Run live test <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href={MCTB_ROUTES.setupPhone} className="mctb-setup-quick-action">
            View forwarding instructions <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href={MCTB_ROUTES.setupTextBack} className="mctb-setup-quick-action">
            Edit recovery message <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href={MCTB_ROUTES.setupConsent} className="mctb-setup-quick-action">
            Change consent method <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link href={MCTB_ROUTES.setupVoicemail} className="mctb-setup-quick-action">
            Change voicemail greeting <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </MctbSetupShell>
  );
}
