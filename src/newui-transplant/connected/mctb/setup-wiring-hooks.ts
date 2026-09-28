"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchMctbSetup, saveMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import { addPauseUntil } from "@/lib/mctb/schedule-shared";
import type { TriggerKey, TriggerState } from "@/lib/mctb/setup-recovery-model";
import type { MctbHandoffConfigDto, MctbNotificationRecipientDto } from "@/lib/mctb/handoff/types";
import type { MctbSetupTestStatus } from "@/lib/mctb/setup-test";
import type { LiveTestStatus } from "@/lib/mctb/onboarding/live-test";
import { formatSetupPhoneLine } from "@/newui-transplant/connected/mctb/setup-hooks";

const TRIGGER_LABELS: Record<TriggerKey, string> = {
  noAnswer: "No answer",
  busy: "Busy",
  rejected: "Rejected / declined",
  timeout: "Unreachable",
  voicemail: "After voicemail",
};

export function useMctbRecoveryWiring() {
  const [loading, setLoading] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<TriggerState>({
    noAnswer: true,
    busy: true,
    rejected: true,
    timeout: true,
    voicemail: false,
  });
  const [cooldownMinutes, setCooldownMinutes] = useState(1440);
  const [delaySeconds, setDelaySeconds] = useState(30);
  const [maxMessages, setMaxMessages] = useState(3);
  const [paused, setPaused] = useState(false);
  const [timezone, setTimezone] = useState("America/New_York");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMctbSetup();
      const r = data.runtime as Record<string, unknown>;
      const sch = data.schedule as { paused?: boolean };
      setPhoneNumberId((r.phoneNumberId as string) ?? null);
      setTriggers({
        noAnswer: Boolean(r.sendAfterNoAnswer),
        busy: Boolean(r.sendAfterBusy),
        rejected: Boolean(r.sendAfterRejected),
        timeout: Boolean(r.sendAfterTimeout),
        voicemail: Boolean(r.sendAfterVoicemail),
      });
      setCooldownMinutes(Number(r.cooldownMinutes ?? 1440));
      setDelaySeconds(Number(r.delaySeconds ?? 30));
      setMaxMessages(Number(r.maxMessagesPerCaller ?? 3));
      setPaused(Boolean(sch?.paused));
      setTimezone(String(r.timezone || "America/New_York"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async () => {
    await saveMctbSetup({
      phoneNumberId,
      triggerRules: triggers,
      cooldownMinutes,
      delaySeconds,
      maxMessagesPerCaller: maxMessages,
      activate: false,
    });
    await reload();
  }, [phoneNumberId, triggers, cooldownMinutes, delaySeconds, maxMessages, reload]);

  const pausePreset = useCallback(
    async (preset: "1 hour" | "Until tomorrow" | "1 week" | "Indefinitely") => {
      if (preset === "Indefinitely") {
        await saveMctbSetup({ enabled: false, pauseUntil: null });
      } else if (preset === "1 week") {
        await saveMctbSetup({
          pauseUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      } else if (preset === "Until tomorrow") {
        await saveMctbSetup({ pauseUntil: addPauseUntil("tomorrow", timezone) });
      } else {
        await saveMctbSetup({ pauseUntil: addPauseUntil("1h", timezone) });
      }
      await reload();
    },
    [timezone, reload],
  );

  return {
    loading,
    paused,
    triggers: Object.entries(TRIGGER_LABELS).map(([key, label]) => ({
      key: key as TriggerKey,
      label,
      on: triggers[key as TriggerKey],
      setOn: (v: boolean) => setTriggers((t) => ({ ...t, [key]: v })),
    })),
    delaySeconds,
    setDelaySeconds,
    cooldownMinutes,
    setCooldownMinutes,
    maxMessages,
    setMaxMessages,
    save,
    pausePreset,
  };
}

export function useMctbVoicemailWiring() {
  const [loading, setLoading] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [greetingText, setGreetingText] = useState("");
  const [greetingActive, setGreetingActive] = useState(false);
  const [sendAfterVoicemail, setSendAfterVoicemail] = useState(true);
  const [voicemailBoxId, setVoicemailBoxId] = useState<string | null>(null);
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMctbSetup();
      const r = data.runtime as Record<string, unknown>;
      const pid = (r.phoneNumberId as string) ?? null;
      setPhoneNumberId(pid);
      setSendAfterVoicemail(Boolean(r.sendAfterVoicemail ?? true));
      if (pid) {
        const res = await fetch(`/api/phone/voicemail?phoneNumberId=${encodeURIComponent(pid)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (res.ok) {
          const box = json.data?.boxes?.[0] as {
            id?: string;
            greetingText?: string;
            greetingUrl?: string;
            transcriptionEnabled?: boolean;
          } | undefined;
          setVoicemailBoxId(box?.id ?? null);
          setGreetingText(box?.greetingText?.trim() || "");
          setGreetingActive(Boolean(box?.greetingUrl || box?.greetingText));
          setTranscriptionEnabled(box?.transcriptionEnabled ?? true);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const saveGreeting = useCallback(async () => {
    if (!phoneNumberId) throw new Error("No phone number configured");
    let boxId: string | undefined;
    const ensure = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure_number_box", phoneNumberId }),
    });
    const ensureJson = await ensure.json();
    if (!ensure.ok) throw new Error(ensureJson.error || "Could not create voicemail box");
    boxId = ensureJson.data?.id;
    const res = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_box", boxId, greetingText }),
    });
    if (!res.ok) {
      const j = await res.json();
      throw new Error(j.error || "Save failed");
    }
    await reload();
  }, [phoneNumberId, greetingText, reload]);

  const saveTranscription = useCallback(
    async (enabled: boolean) => {
      setTranscriptionEnabled(enabled);
      if (!voicemailBoxId) return;
      const res = await fetch("/api/phone/voicemail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_box", boxId: voicemailBoxId, transcriptionEnabled: enabled }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Could not update transcription");
      }
      await reload();
    },
    [voicemailBoxId, reload],
  );

  const saveRecoveryToggle = useCallback(async () => {
    const data = await fetchMctbSetup();
    const r = data.runtime as Record<string, unknown>;
    await saveMctbSetup({
      phoneNumberId,
      triggerRules: {
        noAnswer: Boolean(r.sendAfterNoAnswer),
        busy: Boolean(r.sendAfterBusy),
        rejected: Boolean(r.sendAfterRejected),
        timeout: Boolean(r.sendAfterTimeout),
        voicemail: sendAfterVoicemail,
      },
      activate: false,
    });
    await reload();
  }, [phoneNumberId, sendAfterVoicemail, reload]);

  return {
    loading,
    phoneNumberId,
    greetingText,
    setGreetingText,
    greetingActive,
    sendAfterVoicemail,
    setSendAfterVoicemail,
    saveGreeting,
    saveRecoveryToggle,
    transcriptionEnabled,
    saveTranscription,
  };
}

export function useMctbNotificationsWiring() {
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState<MctbNotificationRecipientDto[]>([]);
  const [config, setConfig] = useState<MctbHandoffConfigDto | null>(null);
  const [urgentBusinessSmsEntitled, setUrgentBusinessSmsEntitled] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mctb/handoff", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) {
        setConfig(json.data.config);
        setRecipients(json.data.recipients || []);
        setUrgentBusinessSmsEntitled(
          json.data.launch?.urgentBusinessSmsEntitled !== false,
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async () => {
    if (!config) return;
    const res = await fetch("/api/mctb/handoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config, recipients }),
    });
    if (!res.ok) {
      const j = await res.json();
      throw new Error(j.error || "Save failed");
    }
    await reload();
  }, [config, recipients, reload]);

  return {
    loading,
    recipients,
    config,
    setConfig,
    setRecipients,
    save,
    urgentBusinessSmsEntitled,
  };
}

export function useMctbLinksWiring() {
  const [loading, setLoading] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [defaultLinkUrl, setDefaultLinkUrl] = useState("");
  const [requestFormEnabled, setRequestFormEnabled] = useState(false);
  const [requestFormUrl, setRequestFormUrl] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMctbSetup();
      const r = data.runtime as Record<string, unknown>;
      setPhoneNumberId((r.phoneNumberId as string) ?? null);
      setDefaultLinkUrl(String(r.defaultLinkUrl || ""));
      setRequestFormEnabled(Boolean(r.requestFormEnabled));
      const token = r.requestFormToken as string | undefined;
      if (token && typeof window !== "undefined") {
        setRequestFormUrl(`${window.location.origin}/f/mctb/${token}`);
      } else {
        setRequestFormUrl("");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(async () => {
    await saveMctbSetup({
      phoneNumberId,
      defaultLinkUrl: defaultLinkUrl.trim() || null,
      requestFormEnabled,
      activate: false,
    });
    await reload();
  }, [phoneNumberId, defaultLinkUrl, requestFormEnabled, reload]);

  const copyRequestForm = useCallback(async () => {
    if (!requestFormUrl) return;
    await navigator.clipboard.writeText(requestFormUrl);
  }, [requestFormUrl]);

  return {
    loading,
    defaultLinkUrl,
    setDefaultLinkUrl,
    requestFormEnabled,
    setRequestFormEnabled,
    requestFormUrl,
    save,
    copyRequestForm,
  };
}

export function useMctbTestWiring() {
  const [loading, setLoading] = useState(true);
  const [setupTest, setSetupTest] = useState<MctbSetupTestStatus | null>(null);
  const [liveTest, setLiveTest] = useState<LiveTestStatus | null>(null);
  const [businessLine, setBusinessLine] = useState("");
  const [messagingReady, setMessagingReady] = useState(false);
  const [senderReady, setSenderReady] = useState(false);
  const [openerSaved, setOpenerSaved] = useState(false);

  const reload = useCallback(async () => {
    const [setupRes, liveRes, setupData, onboardRes] = await Promise.all([
      fetch("/api/mctb/setup-test", { cache: "no-store" }),
      fetch("/api/mctb/live-test", { cache: "no-store" }),
      fetchMctbSetup().catch(() => null),
      fetch("/api/mctb/onboarding", { cache: "no-store" }).catch(() => null),
    ]);
    const setupJson = await setupRes.json().catch(() => ({}));
    const liveJson = await liveRes.json().catch(() => ({}));
    if (setupRes.ok && setupJson.status) setSetupTest(setupJson.status);
    if (liveRes.ok && liveJson.data) setLiveTest(liveJson.data);

    const onboardJson =
      onboardRes && onboardRes.ok ? await onboardRes.json().catch(() => null) : null;
    const { resolveMctbWorkspaceBusinessLineE164 } = await import(
      "@/lib/mctb/resolve-workspace-business-line"
    );
    const lineE164 = resolveMctbWorkspaceBusinessLineE164(
      (setupData?.businessLineE164 as string) || null,
      (onboardJson?.state?.businessNumberE164 as string) || null,
    );
    setBusinessLine(lineE164 ? formatSetupPhoneLine(lineE164) : "");
    const runtime = (setupData?.runtime ?? {}) as { messageTemplate?: string };
    const compliance = (setupData as { compliance?: { messagingReady?: boolean } })?.compliance;
    const messaging = (setupData as { messaging?: { senderMode?: string } })?.messaging;
    const runtimeSender = (runtime as { senderMode?: string }).senderMode;
    const senderMode = messaging?.senderMode ?? runtimeSender ?? "WORKSPACE";
    setMessagingReady(Boolean(compliance?.messagingReady));
    setSenderReady(senderMode === "PLATFORM" || Boolean(compliance?.messagingReady));
    setOpenerSaved(Boolean(runtime.messageTemplate?.trim()));
  }, []);

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, [reload]);

  const startLiveTest = useCallback(async () => {
    const res = await fetch("/api/mctb/live-test", { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not start test");
    if (json.data) setLiveTest(json.data);
    else await reload();
  }, [reload]);

  return {
    loading,
    setupTest,
    liveTest,
    businessLine,
    messagingReady,
    senderReady,
    openerSaved,
    startLiveTest,
    reload,
  };
}
