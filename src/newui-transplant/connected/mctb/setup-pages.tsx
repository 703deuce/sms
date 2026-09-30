"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { openMctbSetupGuide } from "@/newui-transplant/connected/mctb/mctb-setup-guide";
import { ConsentEditor } from "@/newui-transplant/components/mctb/consent-editor";
import { TextBackEditor } from "@/newui-transplant/components/mctb/text-back-editor";
import { ExclusionsTable } from "@/newui-transplant/components/mctb/exclusions-table";
import { TransplantMctbSetupPage } from "@/newui-transplant/mirror/routes/mctb/setup/page";
import { TransplantMctbSetupPhonePage } from "@/newui-transplant/mirror/routes/mctb/setup/phone/page";
import { TransplantMctbSetupRecoveryPage } from "@/newui-transplant/mirror/routes/mctb/setup/recovery/page";
import { TransplantMctbSetupMissedCallRulesPage } from "@/newui-transplant/mirror/routes/mctb/setup/missed-call-rules/page";
import { MctbSetupLinksEditor } from "@/newui-transplant/components/mctb/mctb-setup-links-editor";
import { TransplantMctbSetupVoicemailPage } from "@/newui-transplant/mirror/routes/mctb/setup/voicemail/page";
import { TransplantMctbSetupNotificationsPage, formatRecipientMobile } from "@/newui-transplant/mirror/routes/mctb/setup/notifications/page";
import { TransplantMctbSetupTestPage } from "@/newui-transplant/mirror/routes/mctb/setup/test/page";
import { useMctbSetupApi, formatSetupPhoneLine } from "@/newui-transplant/connected/mctb/setup-hooks";
import { useMctbSetupOverviewWiring } from "@/newui-transplant/connected/mctb/mctb-setup-overview-wiring";
import { useMctbSetupPhoneWiring } from "@/newui-transplant/connected/mctb/mctb-setup-phone-wiring";
import {
  MctbNumberDrawerOpus,
  type MctbNumberDrawerMode,
} from "@/newui-transplant/components/mctb/number-drawer-opus";
import {
  openMctbNumberDrawer,
  useMctbNumberDrawerEvents,
} from "@/lib/mctb/numbers/mctb-number-drawer-controller";
import { buildSetupTestPipelineSteps } from "@/lib/mctb/setup-test-presentation";
import { MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY } from "@/lib/mctb/launch-flags";
import type { MctbNotificationRecipientDto } from "@/lib/mctb/handoff/types";
import {
  useMctbNotificationsWiring,
  useMctbRecoveryWiring,
  useMctbTestWiring,
  useMctbVoicemailWiring,
} from "@/newui-transplant/connected/mctb/setup-wiring-hooks";
import type { MctbHandoffConfigDto, MctbHandoffEventType } from "@/lib/mctb/handoff/types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";

function delayLabelFromSeconds(sec: number): string {
  if (sec <= 0) return "Immediately";
  if (sec === 30) return "30 seconds";
  if (sec === 60) return "1 minute";
  if (sec === 300) return "5 minutes";
  return `${sec} seconds`;
}

function secondsFromDelayLabel(label: string): number {
  if (label === "Immediately") return 0;
  if (label === "30 seconds") return 30;
  if (label === "1 minute") return 60;
  if (label === "5 minutes") return 300;
  return 30;
}

function cooldownLabelFromMinutes(min: number): string {
  if (min === 30) return "30 minutes";
  if (min === 60) return "1 hour";
  if (min === 180) return "3 hours";
  if (min === 360) return "6 hours";
  if (min === 720) return "12 hours";
  if (min === 1440) return "24 hours";
  if (min === 10080) return "7 days";
  return `${min} minutes`;
}

function minutesFromCooldownLabel(label: string): number {
  if (label === "30 minutes") return 30;
  if (label === "1 hour") return 60;
  if (label === "3 hours") return 180;
  if (label === "6 hours") return 360;
  if (label === "12 hours") return 720;
  if (label === "24 hours") return 1440;
  if (label === "7 days") return 10080;
  const m = /^(\d+)\s*minutes?$/i.exec(label.trim());
  if (m) return Math.max(1, Number(m[1]));
  return 1440;
}

const OPUS_EVENT_MAP: Array<{ label: string; event?: MctbHandoffEventType }> = [
  { label: "Customer replied", event: "caller_replied" },
  { label: "Urgent reply", event: "urgent_detected" },
  { label: "Needs reply (15 min)", event: "human_required" },
  { label: "New voicemail", event: "voicemail_received" },
  { label: "Delivery failure", event: "recovery_failure" },
];

export function NewUiMctbSetupOverviewPage() {
  const { loading, loadError, wired, reload } = useMctbSetupOverviewWiring("—");
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading setup…</p>;
  if (!wired) {
    return (
      <div className="p-6 text-sm">
        <p className="text-destructive" role="alert">{loadError || "Could not load setup."}</p>
        <Button type="button" className="mt-3" variant="outline" size="sm" onClick={() => void reload()}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <Page>
      <PageHeader
        title="Setup"
        description="Configure forwarding, consent, recovery, and notifications."
        actions={
          <Button type="button" variant="outline" onClick={() => openMctbSetupGuide()}>
            Setup guide
          </Button>
        }
      />
      <TransplantMctbSetupPage wired={wired} />
    </Page>
  );
}

export function NewUiMctbSetupPhonePage() {
  const searchParams = useSearchParams();
  const [drawerMode, setDrawerMode] = useState<MctbNumberDrawerMode>(null);
  const { loading, loadError, wired, reload } = useMctbSetupPhoneWiring();
  useMctbNumberDrawerEvents(setDrawerMode);

  useEffect(() => {
    const open = searchParams.get("open");
    if (open === "manage" || open === "add" || open === "verify") {
      setDrawerMode(open);
    }
  }, [searchParams]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading phone settings…</p>;
  if (!wired) {
    return (
      <div className="p-6 text-sm">
        <p className="text-destructive" role="alert">{loadError || "Could not load phone settings."}</p>
        <Button type="button" className="mt-3" variant="outline" size="sm" onClick={() => void reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const wiredWithDrawer = {
    ...wired,
    onManageNumbers: () => openMctbNumberDrawer("manage"),
    onAddNumber: () => openMctbNumberDrawer("add"),
  };

  return (
    <>
      <TransplantMctbSetupPhonePage wired={wiredWithDrawer} />
      <MctbNumberDrawerOpus
        open={drawerMode}
        onClose={() => setDrawerMode(null)}
        onNumbersChanged={() => void reload()}
      />
    </>
  );
}

export function NewUiMctbSetupConsentPage() {
  return (
    <Page>
      <PageHeader title="Consent" description="How callers give permission to receive recovery texts." />
      <ConsentEditor />
    </Page>
  );
}

export function NewUiMctbSetupTextBackPage() {
  return (
    <Page>
      <PageHeader title="Text Back" description="Recovery message customers receive after a missed call." />
      <TextBackEditor />
    </Page>
  );
}

export function NewUiMctbSetupMissedCallRulesPage({ embedded }: { embedded?: boolean } = {}) {
  const recovery = useMctbRecoveryWiring();
  if (recovery.loading) return <p className="p-6 text-sm text-muted-foreground">Loading missed-call rules…</p>;
  const body = (
      <TransplantMctbSetupMissedCallRulesPage
        wired={{
          triggers: recovery.triggers.map((t) => ({
            label: t.label,
            on: t.on,
            onChange: t.setOn,
          })),
          onSave: recovery.saveTriggerRulesOnly,
        }}
      />
  );
  if (embedded) return body;
  return (
    <Page>
      <PageHeader title="Missed-call rules" description="Which call outcomes create a missed-call recovery event." />
      {body}
    </Page>
  );
}

export function NewUiMctbSetupRecoveryPage() {
  const recovery = useMctbRecoveryWiring();
  if (recovery.loading) return <p className="p-6 text-sm text-muted-foreground">Loading recovery settings…</p>;
  return (
    <TransplantMctbSetupRecoveryPage
      wired={{
        paused: recovery.paused,
        triggers: [],
        delayLabel: delayLabelFromSeconds(recovery.delaySeconds),
        cooldownLabel: cooldownLabelFromMinutes(recovery.cooldownMinutes),
        maxMessagesLabel: String(recovery.maxMessages),
        onDelayChange: (label) => recovery.setDelaySeconds(secondsFromDelayLabel(label)),
        onCooldownChange: (label) => recovery.setCooldownMinutes(minutesFromCooldownLabel(label)),
        onMaxMessagesChange: (label) => recovery.setMaxMessages(Number(label) || 1),
        onPausePreset: (p) => void recovery.pausePreset(p),
        onResume: recovery.resumeRecovery,
        onSave: recovery.save,
      }}
    />
  );
}

export function NewUiMctbSetupVoicemailPage() {
  const vm = useMctbVoicemailWiring();
  if (vm.loading) return <p className="p-6 text-sm text-muted-foreground">Loading voicemail settings…</p>;
  return (
    <TransplantMctbSetupVoicemailPage
      wired={{
        greetingText: vm.greetingText,
        greetingUrl: vm.greetingUrl,
        onGreetingTextChange: vm.setGreetingText,
        greetingActive: vm.greetingActive,
        greetingCustomActive: vm.greetingCustomActive,
        onSaveGreetingUrl: vm.saveGreetingUrl,
        onUsePlatformDefaultGreeting: vm.usePlatformDefaultGreeting,
        sendAfterVoicemail: vm.sendAfterVoicemail,
        onSendAfterVoicemailChange: vm.setSendAfterVoicemail,
        onSaveGreeting: vm.saveGreeting,
        onSaveRecoveryToggle: vm.saveRecoveryToggle,
        transcriptionEnabled: vm.transcriptionEnabled,
        onTranscriptionEnabledChange: (v) => void vm.saveTranscription(v),
      }}
    />
  );
}

export function NewUiMctbSetupNotificationsPage() {
  const n = useMctbNotificationsWiring();
  const handoffConfigRef = useRef<MctbHandoffConfigDto | null>(null);
  const [handoffPersistError, setHandoffPersistError] = useState<string | null>(null);
  const [recipientSaveError, setRecipientSaveError] = useState<string | null>(null);

  const saveRecipients = (
    next: Array<Omit<MctbNotificationRecipientDto, "id"> & { id?: string }>,
  ) => {
    setRecipientSaveError(null);
    void n.save(next).catch((err) => {
      setRecipientSaveError(err instanceof Error ? err.message : "Could not save recipients");
    });
  };
  const [urgentTestMessage, setUrgentTestMessage] = useState(
    "My basement is flooding and I need someone now.",
  );
  const [urgentTestResult, setUrgentTestResult] = useState<string | null>(null);
  const [urgentTestBusy, setUrgentTestBusy] = useState(false);

  const persistHandoffConfig = (next: MctbHandoffConfigDto) => {
    setHandoffPersistError(null);
    void n.persistConfig(next).catch((err) => {
      setHandoffPersistError(err instanceof Error ? err.message : "Could not save notification settings");
    });
  };

  useEffect(() => {
    handoffConfigRef.current = n.config;
  }, [n.config]);

  const patchHandoffConfig = (patch: Partial<MctbHandoffConfigDto>) => {
    const base = handoffConfigRef.current ?? n.config;
    if (!base) return;
    const next = { ...base, ...patch };
    handoffConfigRef.current = next;
    n.setConfig(next);
    persistHandoffConfig(next);
  };

  const events = useMemo(() => {
    if (!n.config) return undefined;
    return OPUS_EVENT_MAP.map((row) => {
      const matrix = row.event ? n.config!.routingMatrix[row.event] : null;
      const isUrgentRow = row.event === "urgent_detected";
      const smsLaunchDisabled =
        MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY && row.event !== "urgent_detected";
      const smsDisabled =
        !row.event || smsLaunchDisabled || (isUrgentRow && !n.urgentBusinessSmsEntitled);
      return {
        label: row.label,
        email: matrix?.channels?.email ?? matrix?.email ?? true,
        sms: smsDisabled ? false : (matrix?.channels?.sms ?? matrix?.sms ?? false),
        smsDisabled,
        smsDisabledReason: smsLaunchDisabled
          ? "launch_email_only"
          : isUrgentRow && !n.urgentBusinessSmsEntitled
            ? "urgent_sms_requires_plan"
            : undefined,
        onEmailChange: row.event
          ? (v: boolean) => {
              const base = handoffConfigRef.current ?? n.config;
              if (!base) return;
              const prev = base.routingMatrix[row.event!] || { channels: {}, recipientIds: [] as string[] };
              const next = {
                ...base,
                routingMatrix: {
                  ...base.routingMatrix,
                  [row.event!]: {
                    ...prev,
                    channels: { ...(prev.channels || {}), email: v },
                    recipientIds: prev.recipientIds ?? [],
                  },
                },
              };
              handoffConfigRef.current = next;
              n.setConfig(next);
              persistHandoffConfig(next);
            }
          : undefined,
        onSmsChange: row.event
          ? (v: boolean) => {
              const base = handoffConfigRef.current ?? n.config;
              if (!base) return;
              if (smsDisabled) return;
              const prev = base.routingMatrix[row.event!] || { channels: {}, recipientIds: [] as string[] };
              const next = {
                ...base,
                routingMatrix: {
                  ...base.routingMatrix,
                  [row.event!]: {
                    ...prev,
                    channels: { ...(prev.channels || {}), sms: v },
                    recipientIds: prev.recipientIds ?? [],
                  },
                },
              };
              handoffConfigRef.current = next;
              n.setConfig(next);
              persistHandoffConfig(next);
            }
          : undefined,
      };
    });
  }, [n.config, n.recipients, n.setConfig, n.save, n.urgentBusinessSmsEntitled]);

  if (n.loading) return <p className="p-6 text-sm text-muted-foreground">Loading notifications…</p>;

  if (n.loadError && !n.config) {
    return (
      <div className="p-6 text-sm">
        <p className="text-destructive" role="alert">{n.loadError}</p>
        <Button type="button" className="mt-3" variant="outline" size="sm" onClick={() => void n.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      {handoffPersistError ? (
        <p className="mx-6 mt-4 text-sm text-destructive" role="alert">{handoffPersistError}</p>
      ) : null}
      {recipientSaveError ? (
        <p className="mx-6 mt-2 text-sm text-destructive" role="alert">{recipientSaveError}</p>
      ) : null}
    <TransplantMctbSetupNotificationsPage
      wired={{
        urgent: n.config
          ? {
              enabled: Boolean(n.config.emergencyDetectionEnabled),
              instructions: n.config.emergencyCriteria || "",
              urgentBusinessSmsEntitled: n.urgentBusinessSmsEntitled,
              testMessage: urgentTestMessage,
              testBusy: urgentTestBusy,
              testResultLabel: urgentTestResult,
              onEnabledChange: (v) => patchHandoffConfig({ emergencyDetectionEnabled: v }),
              onInstructionsChange: (v) => {
                const base = handoffConfigRef.current ?? n.config;
                if (!base) return;
                const next = { ...base, emergencyCriteria: v };
                handoffConfigRef.current = next;
                n.setConfig(next);
              },
              onInstructionsBlur: () => {
                const cfg = handoffConfigRef.current;
                if (!cfg) return;
                persistHandoffConfig(cfg);
              },
              onTestMessageChange: setUrgentTestMessage,
              onRunTest: () => {
                setUrgentTestBusy(true);
                setUrgentTestResult(null);
                void fetch("/api/mctb/handoff", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    action: "test_urgent_rules",
                    sampleMessage: urgentTestMessage.trim(),
                  }),
                })
                  .then(async (res) => {
                    const json = await res.json();
                    if (!res.ok || !json.ok) {
                      setUrgentTestResult(json.message || json.error || "Test failed");
                      return;
                    }
                    setUrgentTestResult(`${json.label}: ${json.reason}`);
                  })
                  .catch(() => setUrgentTestResult("Test failed"))
                  .finally(() => setUrgentTestBusy(false));
              },
            }
          : undefined,
        recipients: n.recipients.map((r) => ({
          id: r.id,
          name: r.name || r.email || "Recipient",
          email: r.email || "—",
          mobile: formatRecipientMobile(r.mobileE164),
        })),
        onEditRecipient: (id: string) => {
          const current = n.recipients.find((r) => r.id === id);
          if (!current) return;
          const name = window.prompt("Recipient name", current.name || "");
          if (name === null) return;
          const email = window.prompt("Email address", current.email || "");
          if (email === null) return;
          const mobile = window.prompt(
            "Mobile (E.164, optional)",
            current.mobileE164 || "",
          );
          if (mobile === null) return;
          const next = n.recipients.map((r) =>
            r.id === id
              ? {
                  ...r,
                  name: name.trim() || r.name,
                  email: email.trim() || null,
                  mobileE164: mobile.trim() || null,
                }
              : r,
          );
          n.setRecipients(next as MctbNotificationRecipientDto[]);
          saveRecipients(next);
        },
        events: events ?? undefined,
        onAddRecipient: () => {
            const name = window.prompt("Recipient name");
            if (!name?.trim()) return;
            const email = window.prompt("Email address");
            if (!email?.trim()) return;
            const mobile = window.prompt("Mobile (E.164, optional)") || null;
            const next = [
              ...n.recipients,
              {
                name: name.trim(),
                email: email.trim(),
                mobileE164: mobile?.trim() || null,
                roleDescription: null,
                eventChannels: {},
                enabled: true,
                sortOrder: n.recipients.length,
              },
            ];
            n.setRecipients(next as MctbNotificationRecipientDto[]);
            saveRecipients(next);
        },
      }}
    />
    </>
  );
}

export function NewUiMctbSetupExclusionsPage() {
  return (
    <Page>
      <PageHeader title="Exclusions" description="Numbers that should never receive automated recovery texts." />
      <ExclusionsTable />
    </Page>
  );
}

export function NewUiMctbSetupLinksPage() {
  return (
    <Page>
      <PageHeader title="Links & request form" description="Booking URLs, {{link}} variable, and optional public request form." />
      <MctbSetupLinksEditor />
    </Page>
  );
}

export function NewUiMctbSetupTestPage() {
  const test = useMctbTestWiring();
  if (test.loading) return <p className="p-6 text-sm text-muted-foreground">Loading test…</p>;

  const checks = [
    { label: "Business line connected", ok: Boolean(test.businessLine && test.businessLine !== "—") },
    { label: "Forwarding verified (live test)", ok: Boolean(test.liveTest?.passed) },
    {
      label: "Sender ready",
      ok: Boolean(test.senderReady),
      href: MCTB_ROUTES.phone,
    },
    {
      label: "Text-back opener saved",
      ok: test.openerSaved,
      href: MCTB_ROUTES.textBack,
    },
  ];

  const pipelineSteps = buildSetupTestPipelineSteps(test.setupTest);

  return (
    <TransplantMctbSetupTestPage
      wired={{
        checks,
        pipelineSteps,
        setupTestStarted: Boolean(test.setupTest?.started),
        setupTestVerified: Boolean(test.setupTest?.verified),
        setupTestFailureReason: test.setupTest?.failureReason ?? null,
        consentMode: test.setupTest?.consentMode ?? null,
        businessLine: test.businessLine || "—",
        liveStatusTitle: test.liveTest?.started && !test.liveTest.passed ? "Listening for your test call" : "Ready to listen",
        liveStatusDetail:
          test.liveTest?.passed
            ? "Live test passed — forwarding and recovery are working."
            : test.liveTest?.started
              ? "Place a test call from another phone and let it ring out. We listen via live-test; setup-test records pipeline checkpoints."
              : "Start test to arm live-test (forwarding call) and setup-test (recovery pipeline checkpoints). Try-it is onboarding-only.",
        liveListening: Boolean(test.liveTest?.started && !test.liveTest?.passed),
        onStartTest: test.startLiveTest,
      }}
    />
  );
}
