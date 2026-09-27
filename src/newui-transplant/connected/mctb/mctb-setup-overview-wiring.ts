"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import type { MctbForwardingCarrier } from "@/lib/mctb/onboarding/types";
import {
  buildCoreSystemsReadiness,
  buildSetupActivityFromFunnel,
  buildSetupAttentionItems,
  buildSetupGlobalStatus,
  buildSetupSummaryRows,
  formatShortWhenCompact,
} from "@/lib/mctb/setup-overview-model";
import { saveMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import type { MctbSetupOverviewWired } from "@/newui-transplant/mirror/routes/mctb/setup/page";

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
    defaultLinkUrl?: string | null;
    requestFormEnabled?: boolean;
    senderMode?: "PLATFORM" | "WORKSPACE";
    timezone?: string;
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
  messaging?: { senderMode?: "PLATFORM" | "WORKSPACE" };
  consentMeta?: { paidEntitled?: boolean };
};

export function useMctbSetupOverviewWiring(senderFallback: string): {
  loading: boolean;
  wired: MctbSetupOverviewWired | undefined;
  reload: () => Promise<void>;
} {
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [setupRes, onboardRes] = await Promise.all([
        fetch("/api/mctb/setup", { cache: "no-store" }),
        fetch("/api/mctb/onboarding", { cache: "no-store" }),
      ]);

      const setupJson = await setupRes.json();
      if (!setupRes.ok || !setupJson.data) {
        setSetup(null);
        return;
      }

      const data = setupJson.data as SetupApi;
      setSetup(data);

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

      setLoading(false);

      const [exclRes, handoffRes, liveRes] = await Promise.all([
        fetch("/api/mctb/exclusions", { cache: "no-store" }),
        fetch("/api/mctb/handoff", { cache: "no-store" }),
        fetch("/api/mctb/live-test", { cache: "no-store" }),
      ]);

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
          (r) => Boolean(r.email) && Object.values(r.eventChannels || {}).some((ch) => ch?.email),
        );
        const smsOn = active.some(
          (r) => Boolean(r.mobileE164) && Object.values(r.eventChannels || {}).some((ch) => ch?.sms),
        );
        if (active.length === 0) setNotificationSummary("No recipients configured");
        else setNotificationSummary(`${emailOn ? "Email on" : "Email off"} · ${smsOn ? "SMS on" : "SMS off"}`);
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

    } catch {
      setSetup(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const wired = useMemo((): MctbSetupOverviewWired | undefined => {
    if (!setup) return undefined;

    const triggersOn =
      setup.runtime.sendAfterNoAnswer ||
      setup.runtime.sendAfterBusy ||
      setup.runtime.sendAfterRejected ||
      setup.runtime.sendAfterTimeout;

    const globalStatus = buildSetupGlobalStatus({
      runtime: setup.runtime,
      schedule: setup.schedule,
      businessLineE164: setup.businessLineE164,
      phoneNumbers: setup.phoneNumbers,
      forwardingVerified,
      messagingReady: setup.compliance.messagingReady,
      lastTestAt,
    });

    const attention = buildSetupAttentionItems({
      forwardingVerified,
      messagingReady: setup.compliance.messagingReady,
      requiredActions: setup.compliance.requiredActions,
      triggersOn,
      consentMode: setup.consentMode,
      existingConsentBlocked:
        setup.consentMode === "existing_consent" &&
        (!setup.compliance.messagingReady || setup.consentMeta?.paidEntitled === false),
      voicemailConfigured:
        !voicemailSummary.includes("Not") && voicemailSummary !== "Configure in Voicemail",
    });

    const linkUrl = setup.runtime.defaultLinkUrl?.trim();
    const linksSummary = setup.runtime.requestFormEnabled
      ? "Request form enabled"
      : linkUrl
        ? "Default link configured"
        : "Optional";

    const rows = buildSetupSummaryRows({
      runtime: setup.runtime,
      schedule: setup.schedule,
      consentMode: setup.consentMode,
      senderMode: setup.messaging?.senderMode ?? setup.runtime.senderMode ?? null,
      linksSummary,
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
        setup.consentMode === "existing_consent" &&
        (!setup.compliance.messagingReady || setup.consentMeta?.paidEntitled === false),
    });

    const mapRow = (r: (typeof rows)[number]) => ({
      label: r.title,
      value: r.secondary,
      href: r.href,
      tone: r.status === "ok" ? ("success" as const) : r.status === "warning" ? ("warning" as const) : undefined,
    });

    const callFlowRows = rows.filter((r) => r.group === "call-flow").map(mapRow);
    const operationsRows = rows.filter((r) => r.group === "operations").map(mapRow);
    const activity = buildSetupActivityFromFunnel(funnelEvents).map((a) => ({
      time: formatShortWhenCompact(a.at),
      text: a.label,
    }));

    const recoveryActive = !globalStatus.paused && setup.runtime.enabled;
    const senderParts = globalStatus.senderLabel?.split(" · ") ?? [];
    const core = buildCoreSystemsReadiness({
      forwardingVerified,
      messagingReady: setup.compliance.messagingReady,
      recoveryPaused: globalStatus.paused || !setup.runtime.enabled,
      triggersOn,
      messageConfigured: setup.runtime.messageTemplate.trim().length > 0,
      voicemailReady:
        !voicemailSummary.includes("Not") && voicemailSummary !== "Configure in Voicemail",
    });

    const lastTestShort = lastTestAt ? formatShortWhenCompact(lastTestAt) : "Never";

    return {
      businessLine: globalStatus.businessLineLabel ?? "—",
      sender: senderParts[0] || senderFallback,
      recoveryActive,
      recoveryLabel: globalStatus.recoveryLabel,
      forwardingVerified,
      forwardingPillLabel: forwardingVerified ? "Verified" : "Not verified",
      forwardingPillTone: forwardingVerified ? "success" : "warning",
      lastTestLabel: lastTestShort,
      callFlowRows,
      operationsRows,
      activity,
      attentionHeadline: `Needs attention · ${core.ready} of ${core.total} core systems ready`,
      attentionIssues: attention.map((a) => ({
        message: a.message,
        fixHref: a.href,
      })),
      onPauseToggle: async () => {
        if (recoveryActive) {
          await saveMctbSetup({ enabled: false, pauseUntil: null });
        } else {
          await saveMctbSetup({ enabled: true, pauseUntil: null });
        }
        await load();
      },
      pauseButtonLabel: recoveryActive ? "Pause" : "Resume",
    };
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
    funnelEvents,
    senderFallback,
    load,
  ]);

  return { loading, wired, reload: load };
}
