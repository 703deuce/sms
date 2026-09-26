"use client";

import { useMemo } from "react";
import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { ConsentEditor } from "@/newui-transplant/components/mctb/consent-editor";
import { TextBackEditor } from "@/newui-transplant/components/mctb/text-back-editor";
import { ExclusionsTable } from "@/newui-transplant/components/mctb/exclusions-table";
import { TransplantMctbSetupPage } from "@/newui-transplant/mirror/routes/mctb/setup/page";
import { TransplantMctbSetupPhonePage } from "@/newui-transplant/mirror/routes/mctb/setup/phone/page";
import { TransplantMctbSetupRecoveryPage } from "@/newui-transplant/mirror/routes/mctb/setup/recovery/page";
import { TransplantMctbSetupVoicemailPage } from "@/newui-transplant/mirror/routes/mctb/setup/voicemail/page";
import { TransplantMctbSetupNotificationsPage, formatRecipientMobile } from "@/newui-transplant/mirror/routes/mctb/setup/notifications/page";
import { TransplantMctbSetupLinksPage } from "@/newui-transplant/mirror/routes/mctb/setup/links/page";
import { TransplantMctbSetupTestPage } from "@/newui-transplant/mirror/routes/mctb/setup/test/page";
import { useMctbSetupApi, formatSetupPhoneLine } from "@/newui-transplant/connected/mctb/setup-hooks";
import { useMctbSetupOverviewWiring } from "@/newui-transplant/connected/mctb/mctb-setup-overview-wiring";
import { useMctbSetupPhoneWiring } from "@/newui-transplant/connected/mctb/mctb-setup-phone-wiring";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";
import {
  useMctbLinksWiring,
  useMctbNotificationsWiring,
  useMctbRecoveryWiring,
  useMctbTestWiring,
  useMctbVoicemailWiring,
} from "@/newui-transplant/connected/mctb/setup-wiring-hooks";
import type { MctbHandoffEventType } from "@/lib/mctb/handoff/types";

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
  if (min === 60) return "1 hour";
  if (min === 720) return "12 hours";
  if (min === 1440) return "24 hours";
  if (min === 10080) return "7 days";
  return "24 hours";
}

function minutesFromCooldownLabel(label: string): number {
  if (label === "1 hour") return 60;
  if (label === "12 hours") return 720;
  if (label === "24 hours") return 1440;
  if (label === "7 days") return 10080;
  return 1440;
}

const OPUS_EVENT_MAP: Array<{ label: string; event?: MctbHandoffEventType }> = [
  { label: "Customer replied", event: "caller_replied" },
  { label: "Needs reply (15 min)", event: "human_required" },
  { label: "New voicemail", event: "voicemail_received" },
  { label: "Delivery failure", event: "recovery_failure" },
  { label: "Forwarding stopped working" },
];

export function NewUiMctbSetupOverviewPage() {
  const { business } = useOpusWorkspaceData();
  const { loading, wired } = useMctbSetupOverviewWiring(business?.sender || "—");
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading setup…</p>;
  return <TransplantMctbSetupPage wired={wired} />;
}

export function NewUiMctbSetupPhonePage() {
  const { business } = useOpusWorkspaceData();
  const { loading, wired } = useMctbSetupPhoneWiring(business?.sender || "—");
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading phone settings…</p>;
  return <TransplantMctbSetupPhonePage wired={wired} />;
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

export function NewUiMctbSetupRecoveryPage() {
  const recovery = useMctbRecoveryWiring();
  if (recovery.loading) return <p className="p-6 text-sm text-muted-foreground">Loading recovery settings…</p>;
  return (
    <TransplantMctbSetupRecoveryPage
      wired={{
        paused: recovery.paused,
        triggers: [
          ...recovery.triggers.map((t) => ({
            label: t.label,
            on: t.on,
            onChange: t.setOn,
          })),
          { label: "Blocked caller ID", on: false, onChange: () => {} },
        ],
        delayLabel: delayLabelFromSeconds(recovery.delaySeconds),
        cooldownLabel: cooldownLabelFromMinutes(recovery.cooldownMinutes),
        maxMessagesLabel: String(recovery.maxMessages),
        onDelayChange: (label) => recovery.setDelaySeconds(secondsFromDelayLabel(label)),
        onCooldownChange: (label) => recovery.setCooldownMinutes(minutesFromCooldownLabel(label)),
        onMaxMessagesChange: (label) => recovery.setMaxMessages(Number(label) || 1),
        onPausePreset: (p) => void recovery.pausePreset(p),
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
        onGreetingTextChange: vm.setGreetingText,
        greetingActive: vm.greetingActive,
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
  const events = useMemo(() => {
    if (!n.config) return undefined;
    return OPUS_EVENT_MAP.map((row) => {
      const matrix = row.event ? n.config!.routingMatrix[row.event] : null;
      return {
        label: row.label,
        email: matrix?.email ?? true,
        sms: matrix?.sms ?? false,
        onEmailChange: row.event
          ? (v: boolean) => {
              if (!n.config) return;
              const next = { ...n.config, routingMatrix: { ...n.config.routingMatrix } };
              next.routingMatrix[row.event!] = { ...(matrix || {}), email: v };
              n.setConfig(next);
              void fetch("/api/mctb/handoff", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ config: next, recipients: n.recipients }),
              });
            }
          : undefined,
        onSmsChange: row.event
          ? (v: boolean) => {
              if (!n.config) return;
              const next = { ...n.config, routingMatrix: { ...n.config.routingMatrix } };
              next.routingMatrix[row.event!] = { ...(matrix || {}), sms: v };
              n.setConfig(next);
              void fetch("/api/mctb/handoff", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ config: next, recipients: n.recipients }),
              });
            }
          : undefined,
      };
    });
  }, [n.config, n.recipients, n.setConfig, n.save]);

  if (n.loading) return <p className="p-6 text-sm text-muted-foreground">Loading notifications…</p>;

  return (
    <TransplantMctbSetupNotificationsPage
      wired={{
        recipients: n.recipients.map((r) => ({
          name: r.name || r.email || "Recipient",
          email: r.email || "—",
          mobile: formatRecipientMobile(r.mobileE164),
        })),
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
              id: `new-${Date.now()}`,
              name: name.trim(),
              email: email.trim(),
              mobileE164: mobile?.trim() || null,
              roleDescription: null,
              eventChannels: {},
              enabled: true,
              sortOrder: n.recipients.length,
            },
          ];
          n.setRecipients(next);
          void n.save();
        },
      }}
    />
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
  const links = useMctbLinksWiring();
  if (links.loading) return <p className="p-6 text-sm text-muted-foreground">Loading links…</p>;
  return (
    <TransplantMctbSetupLinksPage
      wired={{
        defaultLinkUrl: links.defaultLinkUrl,
        requestFormEnabled: links.requestFormEnabled,
        requestFormUrl: links.requestFormUrl,
        onRequestFormEnabledChange: (v) => {
          links.setRequestFormEnabled(v);
          void links.save();
        },
        onCopyRequestForm: () => void links.copyRequestForm(),
      }}
    />
  );
}

export function NewUiMctbSetupTestPage() {
  const test = useMctbTestWiring();
  if (test.loading) return <p className="p-6 text-sm text-muted-foreground">Loading test…</p>;

  const checks = [
    { label: "Business line connected", ok: Boolean(test.businessLine && test.businessLine !== "—") },
    { label: "Forwarding verified", ok: Boolean(test.liveTest?.passed) },
    { label: "Sender registered", ok: Boolean(test.setupTest?.checks?.smsProviderAccepted) },
    { label: "Consent disclosure published", ok: Boolean(test.setupTest?.checks?.consentModeLoaded) },
    { label: "Text-back opener saved", ok: Boolean(test.setupTest?.checks?.smsQueued) },
    {
      label: "Custom voicemail greeting",
      ok: Boolean(test.setupTest?.checks?.greetingPlayed),
      href: "/mctb/setup/voicemail",
    },
  ];

  return (
    <TransplantMctbSetupTestPage
      wired={{
        checks,
        businessLine: test.businessLine || "—",
        liveStatusTitle: test.liveTest?.started && !test.liveTest.passed ? "Listening for your test call" : "Ready to listen",
        liveStatusDetail:
          test.liveTest?.passed
            ? "Live test passed — forwarding and recovery are working."
            : test.liveTest?.started
              ? "Place a test call from another phone and let it ring out."
              : "We'll detect the call automatically.",
        liveListening: Boolean(test.liveTest?.started && !test.liveTest?.passed),
        onStartTest: test.startLiveTest,
      }}
    />
  );
}
