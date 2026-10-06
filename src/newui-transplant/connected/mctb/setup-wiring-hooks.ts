"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchMctbSetup,
  postMctbHandoff,
  saveMctbSetup,
} from "@/lib/newui-transplant/api/mctb-setup-client";
import { parseMctbHandoffResponse } from "@/lib/mctb/handoff/parse-handoff-response";
import { addPauseUntil } from "@/lib/mctb/schedule-shared";
import { clampMctbMaxMessagesPerCaller } from "@/lib/mctb/recovery-max-messages";
import type { TriggerKey, TriggerState } from "@/lib/mctb/setup-recovery-model";
import type { MctbHandoffConfigDto, MctbNotificationRecipientDto } from "@/lib/mctb/handoff/types";
import type { MctbSetupTestStatus } from "@/lib/mctb/setup-test";
import type { LiveTestStatus } from "@/lib/mctb/onboarding/live-test";
import { resolveMctbLiveRecoveryProvenForUi } from "@/lib/mctb/forwarding-verified-ui";
import { formatSetupPhoneLine } from "@/newui-transplant/connected/mctb/setup-hooks";

const TRIGGER_LABELS: Record<TriggerKey, string> = {
  noAnswer: "No answer",
  busy: "Busy",
  rejected: "Rejected / declined",
  timeout: "Unreachable",
  voicemail: "After voicemail",
};

export type MctbRecoveryWiring = ReturnType<typeof useMctbRecoveryWiring>;

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
      const data = await fetchMctbSetup({ force: true });
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
      setMaxMessages(clampMctbMaxMessagesPerCaller(Number(r.maxMessagesPerCaller ?? 3)));
      setPaused(Boolean(sch?.paused));
      setTimezone(String(r.timezone || "America/New_York"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onSetup = () => {
      void reload();
    };
    window.addEventListener("mctb-setup-updated", onSetup);
    return () => window.removeEventListener("mctb-setup-updated", onSetup);
  }, [reload]);

  const save = useCallback(async () => {
    await saveMctbSetup({
      phoneNumberId,
      triggerRules: triggers,
      cooldownMinutes,
      delaySeconds,
      maxMessagesPerCaller: clampMctbMaxMessagesPerCaller(maxMessages),
      activate: false,
    });
    await reload();
  }, [phoneNumberId, triggers, cooldownMinutes, delaySeconds, maxMessages, reload]);

  const saveTriggerRulesOnly = useCallback(async () => {
    await saveMctbSetup({
      triggerRules: {
        noAnswer: triggers.noAnswer,
        busy: triggers.busy,
        rejected: triggers.rejected,
        timeout: triggers.timeout,
        voicemail: triggers.voicemail,
      },
      activate: false,
    });
    await reload();
  }, [triggers, reload]);

  const resumeRecovery = useCallback(async () => {
    await saveMctbSetup({ enabled: true, pauseUntil: null });
    await reload();
  }, [reload]);

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
    saveTriggerRulesOnly,
    pausePreset,
    resumeRecovery,
  };
}

export function useMctbVoicemailWiring(input?: { phoneNumberId?: string | null }) {
  const phoneNumberIdOverride = input?.phoneNumberId?.trim() || null;
  const [loading, setLoading] = useState(true);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [greetingText, setGreetingText] = useState("");
  const [greetingUrl, setGreetingUrl] = useState<string | null>(null);
  const [greetingActive, setGreetingActive] = useState(false);
  const [greetingCustomActive, setGreetingCustomActive] = useState(false);
  const [sendAfterVoicemail, setSendAfterVoicemail] = useState(true);
  const [voicemailBoxId, setVoicemailBoxId] = useState<string | null>(null);
  const [transcriptionEnabled, setTranscriptionEnabled] = useState(true);
  const [mentionSmsInGreeting, setMentionSmsInGreeting] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMctbSetup({ force: true });
      const r = data.runtime as Record<string, unknown>;
      const pid = phoneNumberIdOverride || ((r.phoneNumberId as string) ?? null);
      setPhoneNumberId(pid);
      setSendAfterVoicemail(Boolean(r.sendAfterVoicemail ?? true));
      const messaging = data.messaging as { voicemailMentionSms?: boolean } | undefined;
      setMentionSmsInGreeting(messaging?.voicemailMentionSms !== false);
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
          setGreetingUrl(box?.greetingUrl ?? null);
          setGreetingCustomActive(Boolean(box?.greetingUrl));
          setGreetingActive(Boolean(pid));
          setTranscriptionEnabled(box?.transcriptionEnabled ?? true);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [phoneNumberIdOverride]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onSetup = () => {
      void reload();
    };
    window.addEventListener("mctb-setup-updated", onSetup);
    return () => window.removeEventListener("mctb-setup-updated", onSetup);
  }, [reload]);

  const ensureVoicemailBoxId = useCallback(async (): Promise<string> => {
    if (!phoneNumberId) throw new Error("No phone number configured");
    if (voicemailBoxId) return voicemailBoxId;
    const ensure = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure_number_box", phoneNumberId }),
    });
    const ensureJson = await ensure.json();
    if (!ensure.ok) throw new Error(ensureJson.error || "Could not create voicemail box");
    const id = ensureJson.data?.id as string;
    if (!id) throw new Error("Could not create voicemail box");
    setVoicemailBoxId(id);
    return id;
  }, [phoneNumberId, voicemailBoxId]);

  const saveGreeting = useCallback(async (textOverride?: string) => {
    const boxId = await ensureVoicemailBoxId();
    const { applyVoicemailSmsReinforcement } = await import("@/lib/mctb/voicemail-sms-reinforcement");
    const raw = (textOverride ?? greetingText).trim();
    const text = applyVoicemailSmsReinforcement(raw, mentionSmsInGreeting);
    const res = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_box", boxId, greetingText: text }),
    });
    if (!res.ok) {
      const j = await res.json();
      throw new Error(j.error || "Save failed");
    }
    await reload();
  }, [ensureVoicemailBoxId, greetingText, mentionSmsInGreeting, reload]);

  const saveMentionSmsToggle = useCallback(async () => {
    await saveMctbSetup({ voicemailMentionSms: mentionSmsInGreeting });
    if (greetingText.trim()) {
      await saveGreeting();
    }
  }, [mentionSmsInGreeting, greetingText, saveGreeting]);

  const saveGreetingUrl = useCallback(
    async (url: string) => {
      const boxId = await ensureVoicemailBoxId();
      const res = await fetch("/api/phone/voicemail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_box", boxId, greetingUrl: url }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Save failed");
      }
      await reload();
    },
    [ensureVoicemailBoxId, reload],
  );

  const usePlatformDefaultGreeting = useCallback(async () => {
    const boxId = await ensureVoicemailBoxId();
    const res = await fetch("/api/phone/voicemail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_box",
        boxId,
        greetingUrl: null,
        greetingText: greetingText.trim() || "Please leave a message after the tone.",
      }),
    });
    if (!res.ok) {
      const j = await res.json();
      throw new Error(j.error || "Could not restore default greeting");
    }
    await reload();
  }, [ensureVoicemailBoxId, greetingText, reload]);

  const saveTranscription = useCallback(
    async (enabled: boolean) => {
      setTranscriptionEnabled(enabled);
      const boxId = voicemailBoxId ?? (await ensureVoicemailBoxId());
      const res = await fetch("/api/phone/voicemail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_box", boxId, transcriptionEnabled: enabled }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Could not update transcription");
      }
      await reload();
    },
    [voicemailBoxId, ensureVoicemailBoxId, reload],
  );

  const saveRecoveryToggle = useCallback(async () => {
    if (!phoneNumberId) throw new Error("No phone number configured");
    await saveMctbSetup({
      phoneNumberId,
      triggerRules: { voicemail: sendAfterVoicemail },
      activate: false,
    });
    await reload();
  }, [phoneNumberId, sendAfterVoicemail, reload]);

  return {
    loading,
    phoneNumberId,
    greetingText,
    setGreetingText,
    greetingUrl,
    saveGreetingUrl,
    greetingActive,
    greetingCustomActive,
    usePlatformDefaultGreeting,
    sendAfterVoicemail,
    setSendAfterVoicemail,
    saveGreeting,
    saveRecoveryToggle,
    transcriptionEnabled,
    saveTranscription,
    mentionSmsInGreeting,
    setMentionSmsInGreeting,
    saveMentionSmsToggle,
  };
}

export function useMctbNotificationsWiring() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<MctbNotificationRecipientDto[]>([]);
  const recipientsRef = useRef<MctbNotificationRecipientDto[]>([]);
  const [config, setConfig] = useState<MctbHandoffConfigDto | null>(null);
  const configRef = useRef<MctbHandoffConfigDto | null>(null);
  const [urgentBusinessSmsEntitled, setUrgentBusinessSmsEntitled] = useState(true);
  const [businessReplySmsEntitled, setBusinessReplySmsEntitled] = useState(true);
  const [urgentDetectionAvailable, setUrgentDetectionAvailable] = useState(false);

  const setConfigSynced = useCallback((next: MctbHandoffConfigDto | null) => {
    configRef.current = next;
    setConfig(next);
  }, []);

  const setRecipientsSynced = useCallback((next: MctbNotificationRecipientDto[]) => {
    recipientsRef.current = next;
    setRecipients(next);
  }, []);

  useEffect(() => {
    recipientsRef.current = recipients;
  }, [recipients]);

  const applyHandoffPayload = useCallback(
    (payload: ReturnType<typeof parseMctbHandoffResponse>) => {
      if (payload.config) {
        setConfigSynced(payload.config);
      }
      setRecipientsSynced(payload.recipients);
      setUrgentBusinessSmsEntitled(payload.launch?.urgentBusinessSmsEntitled !== false);
      setBusinessReplySmsEntitled(payload.launch?.businessReplySmsEntitled !== false);
      setUrgentDetectionAvailable(payload.launch?.urgentDetectionAvailable === true);
    },
    [setConfigSynced, setRecipientsSynced],
  );

  const reload = useCallback(async () => {
    const blockUi =
      configRef.current == null && (recipientsRef.current?.length ?? 0) === 0;
    if (blockUi) setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/mctb/handoff", {
        cache: "no-store",
        headers: { Pragma: "no-cache" },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((json as { error?: string }).error || "Could not load notifications");
      }
      applyHandoffPayload(parseMctbHandoffResponse(json));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load notifications");
      // Keep last-known recipients/config on refresh failure — do not wipe UI after a successful save.
    } finally {
      setLoading(false);
    }
  }, [applyHandoffPayload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onHandoffUpdated = () => {
      void reload();
    };
    window.addEventListener("mctb-handoff-updated", onHandoffUpdated);
    return () => window.removeEventListener("mctb-handoff-updated", onHandoffUpdated);
  }, [reload]);

  const persistConfig = useCallback(async (handoffConfig: MctbHandoffConfigDto) => {
    configRef.current = handoffConfig;
    setConfigSynced(handoffConfig);
    await postMctbHandoff({ config: handoffConfig });
  }, [setConfigSynced]);

  const save = useCallback(
    async (
      recipientsOverride?: Array<Omit<MctbNotificationRecipientDto, "id"> & { id?: string }>,
    ) => {
    const payloadRecipients = recipientsOverride ?? recipientsRef.current ?? recipients;
    const latestConfig = configRef.current ?? config;
    const saved = await postMctbHandoff({
      ...(latestConfig ? { config: latestConfig } : {}),
      recipients: payloadRecipients,
    });
    if (saved) {
      applyHandoffPayload(saved);
    }
    await reload();
  },
  [config, recipients, reload, applyHandoffPayload],
  );

  return {
    loading,
    loadError,
    recipients,
    config,
    setConfig: setConfigSynced,
    setRecipients: setRecipientsSynced,
    persistConfig,
    save,
    reload,
    urgentBusinessSmsEntitled,
    businessReplySmsEntitled,
    urgentDetectionAvailable,
  };
}

export function useMctbLinksWiring() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [defaultLinkUrl, setDefaultLinkUrl] = useState("");
  const [requestFormEnabled, setRequestFormEnabled] = useState(false);
  const [requestFormUrl, setRequestFormUrl] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchMctbSetup({ force: true });
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
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load links settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const onSetup = () => {
      void reload();
    };
    window.addEventListener("mctb-setup-updated", onSetup);
    return () => window.removeEventListener("mctb-setup-updated", onSetup);
  }, [reload]);

  const save = useCallback(async () => {
    await saveMctbSetup({
      ...(phoneNumberId ? { phoneNumberId } : {}),
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
    loadError,
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
  const reloadGeneration = useRef(0);
  const recoveryProvenRef = useRef(false);

  const reload = useCallback(async () => {
    const generation = ++reloadGeneration.current;
    const [setupRes, liveRes, setupData, onboardRes] = await Promise.all([
      fetch("/api/mctb/setup-test", { cache: "no-store" }),
      fetch("/api/mctb/live-test", { cache: "no-store" }),
      fetchMctbSetup({ force: true }).catch(() => null),
      fetch("/api/mctb/onboarding", { cache: "no-store" }).catch(() => null),
    ]);
    if (generation !== reloadGeneration.current) return;
    const setupJson = await setupRes.json().catch(() => ({}));
    const liveJson = await liveRes.json().catch(() => ({}));
    if (setupRes.ok && setupJson.status) setSetupTest(setupJson.status);
    if (liveRes.ok && liveJson.data) setLiveTest(liveJson.data);

    const recoveryProven = resolveMctbLiveRecoveryProvenForUi({
      liveTest: liveRes.ok ? (liveJson.data as LiveTestStatus) : null,
      setupTest: setupRes.ok ? (setupJson.status as MctbSetupTestStatus) : null,
    });
    const wasProven = recoveryProvenRef.current;
    recoveryProvenRef.current = recoveryProven;
    if (recoveryProven && !wasProven && typeof window !== "undefined") {
      window.dispatchEvent(new Event("mctb-setup-updated"));
    }

    const onboardJson =
      onboardRes && onboardRes.ok ? await onboardRes.json().catch(() => null) : null;
    const { resolveMctbWorkspaceBusinessLineE164 } = await import(
      "@/lib/mctb/resolve-workspace-business-line"
    );
    const lineE164 = resolveMctbWorkspaceBusinessLineE164(
      (setupData?.businessLineE164 as string) || null,
      (onboardJson?.state?.businessNumberE164 as string) || null,
    );
    if (generation !== reloadGeneration.current) return;
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

  useEffect(() => {
    const onSetup = () => {
      void reload();
    };
    window.addEventListener("mctb-setup-updated", onSetup);
    return () => window.removeEventListener("mctb-setup-updated", onSetup);
  }, [reload]);

  const startLiveTest = useCallback(async () => {
    const setupRes = await fetch("/api/mctb/setup-test", { method: "POST" });
    if (!setupRes.ok) {
      const j = await setupRes.json().catch(() => ({}));
      throw new Error(typeof j.error === "string" ? j.error : "Could not start setup test");
    }
    const restart = Boolean(liveTest?.started);
    const res = await fetch("/api/mctb/live-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restart }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not start test");
    if (json.data) setLiveTest(json.data);
    else await reload();
  }, [liveTest?.started, reload]);

  useEffect(() => {
    const recoveryProven = resolveMctbLiveRecoveryProvenForUi({ liveTest, setupTest });
    const listenActive = Boolean(
      (setupTest?.started && !setupTest?.verified) ||
        (liveTest?.started && !recoveryProven),
    );
    if (!listenActive) return;
    const id = window.setInterval(() => {
      void reload();
    }, 3000);
    return () => window.clearInterval(id);
  }, [
    setupTest?.started,
    setupTest?.verified,
    liveTest?.started,
    liveTest?.passed,
    liveTest?.checks,
    reload,
  ]);

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
