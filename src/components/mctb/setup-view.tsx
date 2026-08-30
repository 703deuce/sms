"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_LABELS,
  MCTB_CONSENT_MODE_VERIFIED,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MctbConsentPromptEditor } from "@/components/mctb/consent-prompt-editor";
import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { MctbVoicemailSetupSection } from "@/components/mctb/voicemail-setup-section";
import { traceMctbClient } from "@/lib/mctb/debug-client";

type PhoneOption = {
  id: string;
  e164: string;
  friendlyName: string | null;
  type?: string | null;
  a2pStatus?: string | null;
  source?: "owned" | "linked";
  sourceLabel?: string;
  messagingStatus?: {
    approved: boolean;
    complianceType: string;
    status: string;
    label: string;
    numberClass: string;
  };
};

type SetupData = {
  runtime: {
    enabled: boolean;
    phoneNumberId: string | null;
    smsPhoneNumberId: string | null;
    messageTemplate: string;
    messageTemplateBusinessHours?: string | null;
    messageTemplateAfterHours?: string | null;
    delaySeconds: number;
    sendAfterNoAnswer: boolean;
    sendAfterBusy: boolean;
    sendAfterRejected: boolean;
    sendAfterTimeout: boolean;
    sendAfterVoicemail: boolean;
    businessHoursOnly: boolean;
    allowedStartTime: string | null;
    allowedEndTime: string | null;
    timezone: string;
    cooldownMinutes: number;
    conversationEnabled: boolean;
    directDialForwardE164?: string | null;
    defaultLinkUrl?: string | null;
    requestFormEnabled?: boolean;
    requestFormToken?: string | null;
    leadCaptureEnabled?: boolean;
  };
  consentMode: MctbConsentMode;
  phoneNumbers: PhoneOption[];
  compliance: {
    messagingReady: boolean;
    requiredActions: string[];
    brandStatus: string;
    campaignStatus: string;
  };
  adminTest?: {
    isPlatformAdmin: boolean;
    isAdminTestWorkspace: boolean;
    platformDemoLinked: boolean;
    canBootstrap: boolean;
    productionForwardTargetE164?: string | null;
    businessLineE164?: string | null;
  };
  prefills: {
    campaignDescription: string;
    press1Consent: string;
  };
  productionForwardTargetE164?: string | null;
  businessLineE164?: string | null;
  schedule?: {
    paused: boolean;
    pauseKind?: "manual" | "timed" | null;
    pauseUntil?: string | null;
  };
  solution: { setupId: string | null; status: string } | null;
};

const SECTIONS = [
  { id: "number", title: "1. Choose the number" },
  { id: "forwarding", title: "2. Carrier forwarding" },
  { id: "triggers", title: "3. Trigger" },
  { id: "voicemail", title: "4. Voicemail" },
  { id: "message", title: "5. First Text" },
  { id: "links", title: "6. Links & request form" },
  { id: "consent", title: "7. Consent" },
  { id: "hours", title: "8. Schedule" },
  { id: "cooldown", title: "9. Recovery behavior" },
  { id: "replies", title: "10. Reply handling" },
  { id: "exclusions", title: "11. Do-not-text list" },
  { id: "test", title: "12. Test" },
] as const;

type ExclusionRow = {
  id: string;
  phone: string;
  reason: string | null;
  source: string;
  createdAt: string;
};

function fmtPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return e164;
}

export function MctbSetupView() {
  const [data, setData] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedWhilePaused, setSavedWhilePaused] = useState(false);
  const [switchingNumber, setSwitchingNumber] = useState(false);

  const [phoneNumberId, setPhoneNumberId] = useState<string | null>(null);
  const [messageTemplate, setMessageTemplate] = useState("");
  const [messageTemplateBusinessHours, setMessageTemplateBusinessHours] = useState("");
  const [messageTemplateAfterHours, setMessageTemplateAfterHours] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [consentMode, setConsentMode] = useState<MctbConsentMode>(MCTB_CONSENT_MODE_VERIFIED);
  const [triggers, setTriggers] = useState({
    noAnswer: true,
    busy: true,
    rejected: true,
    timeout: true,
    voicemail: false,
    afterHours: false,
  });
  const [businessHoursOnly, setBusinessHoursOnly] = useState(false);
  const [allowedStartTime, setAllowedStartTime] = useState("09:00");
  const [allowedEndTime, setAllowedEndTime] = useState("17:00");
  const [timezone, setTimezone] = useState("America/New_York");
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [replyNotifications, setReplyNotifications] = useState(true);
  const [existingConsentAttested, setExistingConsentAttested] = useState(false);
  const [setupTest, setSetupTest] = useState<{
    started: boolean;
    verified: boolean;
    checks: Record<string, boolean>;
  } | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [businessLineE164, setBusinessLineE164] = useState("");
  const [exclusions, setExclusions] = useState<ExclusionRow[]>([]);
  const [exclusionPhone, setExclusionPhone] = useState("");
  const [exclusionReason, setExclusionReason] = useState("Do not text");
  const [exclusionBusy, setExclusionBusy] = useState(false);
  const [defaultLinkUrl, setDefaultLinkUrl] = useState("");
  const [requestFormEnabled, setRequestFormEnabled] = useState(false);
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false);
  const [requestFormUrl, setRequestFormUrl] = useState<string | null>(null);
  const [directDialForwardE164, setDirectDialForwardE164] = useState("");

  const loadExclusions = useCallback(async () => {
    try {
      const res = await fetch("/api/mctb/exclusions", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && Array.isArray(json.data)) {
        setExclusions(json.data as ExclusionRow[]);
      }
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    traceMctbClient("setup", "load_start");
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load setup");
      const payload = json.data as SetupData;
      traceMctbClient("setup", "load_complete", {
        phoneNumberId: payload.runtime.phoneNumberId,
        consentMode: payload.consentMode,
        phoneOptionCount: payload.phoneNumbers.length,
      });
      setData(payload);
      const r = payload.runtime;
      setPhoneNumberId(r.phoneNumberId);
      setMessageTemplate(r.messageTemplate);
      setMessageTemplateBusinessHours(r.messageTemplateBusinessHours || "");
      setMessageTemplateAfterHours(r.messageTemplateAfterHours || "");
      setDelaySeconds(r.delaySeconds);
      setConsentMode(payload.consentMode);
      setTriggers({
        noAnswer: r.sendAfterNoAnswer,
        busy: r.sendAfterBusy,
        rejected: r.sendAfterRejected,
        timeout: r.sendAfterTimeout,
        voicemail: r.sendAfterVoicemail,
        afterHours: r.businessHoursOnly,
      });
      setBusinessHoursOnly(r.businessHoursOnly);
      setAllowedStartTime(r.allowedStartTime || "09:00");
      setAllowedEndTime(r.allowedEndTime || "17:00");
      setTimezone(r.timezone);
      setCooldownMinutes(r.cooldownMinutes);
      setReplyNotifications(r.conversationEnabled);
      setDefaultLinkUrl(r.defaultLinkUrl || "");
      setRequestFormEnabled(Boolean(r.requestFormEnabled));
      setLeadCaptureEnabled(Boolean(r.leadCaptureEnabled));
      setDirectDialForwardE164(r.directDialForwardE164 || "");
      if (r.requestFormToken) {
        setRequestFormUrl(`/f/mctb/${encodeURIComponent(r.requestFormToken)}`);
      } else {
        setRequestFormUrl(null);
      }
      const line =
        payload.businessLineE164?.trim() ||
        payload.adminTest?.businessLineE164?.trim() ||
        "";
      if (line) setBusinessLineE164(line);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load";
      traceMctbClient("setup", "load_failed", { error: message });
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadExclusions();
  }, [load, loadExclusions]);

  useEffect(() => {
    if (!setupTest?.started || setupTest.verified) return;
    const timer = setInterval(() => {
      void fetch("/api/mctb/setup-test", { cache: "no-store" })
        .then((res) => res.json())
        .then((json) => {
          if (!json?.status) return;
          setSetupTest({
            started: json.status.started,
            verified: json.status.verified,
            checks: json.status.checks,
          });
        })
        .catch(() => undefined);
    }, 3000);
    return () => clearInterval(timer);
  }, [setupTest?.started, setupTest?.verified]);

  const selectedNumber = useMemo(
    () => data?.phoneNumbers.find((n) => n.id === phoneNumberId) || null,
    [data?.phoneNumbers, phoneNumberId],
  );

  const productionForwardE164 = useMemo(() => {
    return selectedNumber?.e164 || data?.productionForwardTargetE164 || null;
  }, [selectedNumber, data?.productionForwardTargetE164]);

  const previewMessage = useMemo(() => {
    const name = selectedNumber?.friendlyName || "Your Business";
    return messageTemplate.replace(/\{\{customer\.firstName\}\}/g, "there").replace(
      /\{\{business\.name\}\}/g,
      name,
    );
  }, [messageTemplate, selectedNumber]);

  async function switchMctbNumber(nextId: string | null) {
    const previousId = phoneNumberId;
    traceMctbClient("setup", "number_switch_start", {
      fromPhoneNumberId: previousId,
      toPhoneNumberId: nextId,
    });
    setPhoneNumberId(nextId);
    if (!nextId || nextId === previousId) return;

    setSwitchingNumber(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phoneNumberId: nextId, activate: false }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not switch number");
      if (json.data?.sipProvision && !json.data.sipProvision.ok) {
        throw new Error(json.data.sipProvision.error || "Voice/SIP provisioning failed");
      }
      traceMctbClient("setup", "number_switch_complete", {
        fromPhoneNumberId: previousId,
        toPhoneNumberId: nextId,
        sipProvision: json.data?.sipProvision ?? null,
        tenantBinding: json.data?.tenantBinding ?? null,
      });
      setSaved(true);
      setSavedWhilePaused(Boolean(json.data?.schedule?.paused));
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not switch number";
      traceMctbClient("setup", "number_switch_failed", {
        fromPhoneNumberId: previousId,
        toPhoneNumberId: nextId,
        error: message,
      });
      setPhoneNumberId(previousId);
      setError(message);
    } finally {
      setSwitchingNumber(false);
    }
  }

  async function save(activate: boolean) {
    setSaving(true);
    setError(null);
    setSaved(false);
    setSavedWhilePaused(false);
    traceMctbClient("setup", "save_start", {
      phoneNumberId,
      consentMode,
      activate,
    });
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phoneNumberId,
          messageTemplate,
          messageTemplateBusinessHours: messageTemplateBusinessHours.trim() || null,
          messageTemplateAfterHours: messageTemplateAfterHours.trim() || null,
          delaySeconds,
          consentMode,
          existingConsentAttested:
            consentMode === MCTB_CONSENT_MODE_EXISTING ? existingConsentAttested : undefined,
          cooldownMinutes,
          replyNotifications,
          businessHoursOnly,
          allowedStartTime: businessHoursOnly ? allowedStartTime : null,
          allowedEndTime: businessHoursOnly ? allowedEndTime : null,
          timezone,
          businessLineE164: businessLineE164.trim() || null,
          directDialForwardE164: directDialForwardE164.trim() || null,
          defaultLinkUrl: defaultLinkUrl.trim() || null,
          requestFormEnabled,
          leadCaptureEnabled,
          triggerRules: triggers,
          activate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      if (json.data?.sipProvision && !json.data.sipProvision.ok) {
        throw new Error(json.data.sipProvision.error || "Voice/SIP provisioning failed");
      }
      const stillPaused = Boolean(json.data?.schedule?.paused);
      traceMctbClient("setup", "save_complete", {
        phoneNumberId,
        activate,
        paused: stillPaused,
        sipProvision: json.data?.sipProvision ?? null,
        tenantBinding: json.data?.tenantBinding ?? null,
        consentSync: json.data?.consentSync ?? null,
      });
      setSaved(true);
      setSavedWhilePaused(stillPaused);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      traceMctbClient("setup", "save_failed", { phoneNumberId, activate, error: message });
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="voice-card px-6 py-16 text-center text-sm text-muted-foreground">
        Loading setup…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
          Text Back Setup
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Central configuration for missed-call text back — triggers, consent, first message,
          voicemail, recovery behavior, and testing.
        </p>
      </div>

      {data?.schedule?.paused ? (
        <MctbPausedNotice
          pauseKind={data.schedule.pauseKind}
          pauseUntil={data.schedule.pauseUntil}
          variant="banner"
        />
      ) : null}

      {!data?.compliance.messagingReady ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
          <p className="font-semibold">Messaging setup incomplete</p>
          <p className="mt-1">
            {data?.adminTest?.isAdminTestWorkspace
              ? "Select an A2P-approved number below, or use Admin test setup to link your assigned MCTB line."
              : "Complete verification before missed-call text back can go live."}{" "}
            <Link href="/compliance" className="font-semibold text-amber-900 underline">
              Open Messaging Compliance →
            </Link>
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-950">
          <p className="font-semibold">Messaging ready</p>
          <p className="mt-1">
            At least one assigned number has approved SMS messaging (A2P or toll-free verification).
            {data?.schedule?.paused
              ? " You can save setup changes while paused; text-backs resume when you turn them back on from Schedule."
              : " You can save, activate, and run production tests."}
          </p>
        </div>
      )}

      {data?.adminTest?.canBootstrap ? (
        <Card className="space-y-3 border-violet-200 bg-violet-50/40 p-5">
          <h2 className="text-[15px] font-semibold text-[#111827]">Admin test setup</h2>
          <p className="text-[13px] text-muted-foreground">
            One-click setup for platform admin testing: links your assigned MCTB number to this
            workspace (without moving DID ownership), wires MCTB runtime, and enables unlimited test
            sends. Use this to run Try It, Test My Setup, and paid-customer flows in the browser.
          </p>
          <p className="text-[13px] text-muted-foreground">
            Production path: forward your business line to{" "}
            <strong>
              {productionForwardE164 ? fmtPhone(productionForwardE164) : "your assigned MCTB number"}
            </strong>
            , then call your business line from another phone. Calls route through the MCTB TeXML
            pipeline (`mctb-entry`) — Press 1 or existing consent, per your setup. Try It uses the shared demo
            number with a direct dial (no forwarding).
          </p>
          <label className="block space-y-1.5">
            <span className="text-[12px] font-semibold text-[#374151]">
              Your business line (forward this number to your assigned MCTB number)
            </span>
            <input
              className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px]"
              placeholder="+1..."
              value={businessLineE164}
              onChange={(e) => setBusinessLineE164(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#4b5563]">
            <span>
              Assigned MCTB number linked:{" "}
              <strong>{data.adminTest.platformDemoLinked ? "Yes" : "No"}</strong>
            </span>
            <span>·</span>
            <span>
              Admin test mode:{" "}
              <strong>{data.adminTest.isAdminTestWorkspace ? "Active" : "Not set"}</strong>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              disabled={bootstrapping || saving}
              onClick={() => {
                setBootstrapping(true);
                setError(null);
                void fetch("/api/mctb/admin-test/bootstrap", { method: "POST" })
                  .then(async (res) => {
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || "Bootstrap failed");
                    await load();
                  })
                  .catch((err) => {
                    setError(err instanceof Error ? err.message : "Bootstrap failed");
                  })
                  .finally(() => setBootstrapping(false));
              }}
            >
              {bootstrapping ? "Setting up…" : "Set up admin test account"}
            </Button>
            <Link href="/voice/try-it">
              <Button variant="outline">Open Try It</Button>
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="hidden space-y-1 lg:block">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="block rounded-lg px-3 py-2 text-[13px] font-medium text-[#4b5563] hover:bg-[#f3f4f6]"
            >
              {s.title}
            </a>
          ))}
        </nav>

        <div className="space-y-5">
          <Card id="number" className="scroll-mt-24 space-y-4 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">Choose the number</h2>
            <p className="text-[13px] text-muted-foreground">
              Which business number should use missed-call recovery? Switching updates which line
              handles missed-call text back.
            </p>
            <select
              className="h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px]"
              value={phoneNumberId || ""}
              disabled={switchingNumber || saving}
              onChange={(e) => void switchMctbNumber(e.target.value || null)}
            >
              <option value="">Select a number…</option>
              {(data?.phoneNumbers || []).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.friendlyName ? `${n.friendlyName} · ` : ""}
                  {fmtPhone(n.e164)}
                  {n.source === "linked" ? " · Assigned" : ""}
                  {n.messagingStatus
                    ? ` — ${n.messagingStatus.label}`
                    : n.a2pStatus
                      ? ` — ${n.a2pStatus}`
                      : ""}
                </option>
              ))}
            </select>
            {switchingNumber ? (
              <p className="text-[12px] text-muted-foreground">Switching missed-call number…</p>
            ) : null}
            {selectedNumber?.source === "linked" ? (
              <p className="text-[12px] text-violet-800">
                {selectedNumber.sourceLabel || "Assigned to your workspace"} — also listed under My
                Numbers.
              </p>
            ) : null}
            {selectedNumber?.messagingStatus ? (
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-[12px]",
                  selectedNumber.messagingStatus.approved
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-amber-50 text-amber-950",
                )}
              >
                <p className="font-semibold">
                  {selectedNumber.messagingStatus.approved
                    ? "SMS messaging approved"
                    : "SMS messaging not approved yet"}
                </p>
                <p className="mt-0.5">
                  {selectedNumber.messagingStatus.complianceType === "A2P_10DLC"
                    ? "Telnyx 10DLC / A2P"
                    : selectedNumber.messagingStatus.complianceType === "TOLL_FREE_VERIFICATION"
                      ? "Toll-free verification"
                      : "Messaging compliance"}
                  {" · "}
                  {selectedNumber.messagingStatus.label}
                  {" · "}
                  Voice + SMS + inbound supported when provisioned
                </p>
              </div>
            ) : null}
            <Link href="/voice/numbers" className="text-[13px] font-semibold text-primary hover:underline">
              Manage numbers →
            </Link>
          </Card>

          <Card id="forwarding" className="scroll-mt-24 space-y-4 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">Carrier forwarding</h2>
            <p className="text-[13px] text-muted-foreground">
              For production, forward your carrier business line to the MCTB number you chose above.
              That same number sends recovery texts (once A2P or toll-free verification is approved)
              and routes the number through Telnyx TeXML (`mctb-entry`) — Press 1 or existing consent,
              depending on your setup.
            </p>
            {productionForwardE164 ? (
              <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Forward your business line to
                </p>
                <p className="mt-1 font-mono text-lg font-semibold text-[#111827]">
                  {fmtPhone(productionForwardE164)}
                </p>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Call your business line from another phone after forwarding — do not dial this
                  number directly for production tests (use{" "}
                  <Link href="/voice/try-it" className="font-semibold text-primary hover:underline">
                    Try It
                  </Link>{" "}
                  for a no-forwarding demo).
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-amber-800">
                Select and save an A2P-approved number above to see your forward target.
              </p>
            )}
          </Card>

          <Card id="triggers" className="scroll-mt-24 space-y-3 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">Trigger</h2>
            {(
              [
                ["noAnswer", "No answer"],
                ["busy", "Busy"],
                ["rejected", "Rejected"],
                ["timeout", "Ring timeout"],
                ["voicemail", "Voicemail"],
                ["afterHours", "After hours (when outside business hours)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-[13px] text-[#374151]">
                <input
                  type="checkbox"
                  checked={triggers[key]}
                  onChange={(e) => setTriggers((t) => ({ ...t, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </Card>

          <Card id="voicemail" className="scroll-mt-24 space-y-4 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">Voicemail</h2>
            <MctbVoicemailSetupSection phoneNumberId={phoneNumberId} />
          </Card>

          <Card id="message" className="scroll-mt-24 space-y-4 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">First Text</h2>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold text-[#374151]">First SMS</span>
              <textarea
                className="min-h-[100px] w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px]"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold text-[#374151]">
                Business hours message (optional)
              </span>
              <textarea
                className="min-h-[80px] w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px]"
                placeholder="Used during your business hours when set"
                value={messageTemplateBusinessHours}
                onChange={(e) => setMessageTemplateBusinessHours(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold text-[#374151]">
                After hours message (optional)
              </span>
              <textarea
                className="min-h-[80px] w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px]"
                placeholder="Used outside business hours when set"
                value={messageTemplateAfterHours}
                onChange={(e) => setMessageTemplateAfterHours(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold text-[#374151]">
                Delay before sending (seconds)
              </span>
              <input
                type="number"
                min={0}
                className="h-10 w-full max-w-[200px] rounded-lg border border-[#D1D5DB] px-3 text-[14px]"
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value || 0))}
              />
            </label>
            <div className="rounded-lg bg-[#f9fafb] p-3 text-[13px] text-[#374151]">
              <p className="font-semibold text-[#111827]">Preview</p>
              <p className="mt-1 whitespace-pre-wrap">{previewMessage}</p>
            </div>
          </Card>

          <Card id="links" className="scroll-mt-24 space-y-4 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">Links & request form</h2>
            <p className="text-[13px] text-muted-foreground">
              Track link clicks in recovery texts and optionally send callers to a public request form.
            </p>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold">Default link URL</span>
              <input
                className="h-10 w-full rounded-lg border px-3 text-[14px]"
                placeholder="https://example.com/contact"
                value={defaultLinkUrl}
                onChange={(e) => setDefaultLinkUrl(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Use {"{{link}}"} in your message template. Only http/https URLs are allowed.
              </p>
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={requestFormEnabled}
                onChange={(e) => setRequestFormEnabled(e.target.checked)}
              />
              Enable public request form (replaces default link when enabled)
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={leadCaptureEnabled}
                onChange={(e) => setLeadCaptureEnabled(e.target.checked)}
              />
              Upsert contacts from form submissions
            </label>
            {requestFormUrl ? (
              <div className="rounded-lg bg-[#f9fafb] p-3 text-[12px]">
                <p className="font-semibold text-[#111827]">Public form URL</p>
                <p className="mt-1 break-all text-primary">{requestFormUrl}</p>
              </div>
            ) : null}
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold">Direct dial forward (optional)</span>
              <input
                className="h-10 w-full rounded-lg border px-3 text-[14px]"
                placeholder="+15551234567"
                value={directDialForwardE164}
                onChange={(e) => setDirectDialForwardE164(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                When set, SIP ingress can forward callers directly without the consent prompt.
              </p>
            </label>
          </Card>

          <Card id="consent" className="scroll-mt-24 space-y-4 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">
              How do you have permission to text callers?
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {([MCTB_CONSENT_MODE_EXISTING, MCTB_CONSENT_MODE_VERIFIED] as const).map((mode) => {
                const meta = MCTB_CONSENT_MODE_LABELS[mode];
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setConsentMode(mode)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition",
                      consentMode === mode
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-[#e5e7eb] hover:border-[#d1d5db]",
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {meta.productCode.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-[#111827]">{meta.title}</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{meta.subtitle}</p>
                  </button>
                );
              })}
            </div>

            {consentMode === MCTB_CONSENT_MODE_VERIFIED ? (
              <MctbConsentPromptEditor phoneNumberId={phoneNumberId} />
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-dashed border-[#d1d5db] bg-white p-4 text-[12px] text-[#4b5563]">
                  <p className="font-semibold text-[#111827]">Existing consent selected</p>
                  <p className="mt-1">
                    Missed calls proceed directly to your recovery text after eligibility checks —
                    no voice prompt or DTMF.
                  </p>
                </div>
                <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={existingConsentAttested}
                    onChange={(e) => setExistingConsentAttested(e.target.checked)}
                  />
                  <span>
                    I certify that I have the required permission to send SMS messages to callers
                    covered by this setup.
                  </span>
                </label>
              </div>
            )}

            <div className="rounded-lg bg-[#f9fafb] p-3 text-[12px] text-[#4b5563]">
              <p className="font-semibold text-[#111827]">Messaging use case (for toll-free verification)</p>
              <p className="mt-1">{data?.prefills.campaignDescription}</p>
              <p className="mt-3 font-semibold text-[#111827]">Opt-in description</p>
              <p className="mt-1">
                {consentMode === MCTB_CONSENT_MODE_VERIFIED
                  ? data?.prefills.press1Consent
                  : "Describe how callers previously opted in to receive texts from your business."}
              </p>
              <Link href="/compliance/campaign" className="mt-2 inline-block font-semibold text-primary">
                Edit in Messaging Compliance →
              </Link>
            </div>
          </Card>

          <Card id="hours" className="scroll-mt-24 space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold text-[#111827]">Schedule</h2>
              <Link href="/voice/schedule" className="text-[13px] font-semibold text-primary hover:underline">
                Open Schedule page →
              </Link>
            </div>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={businessHoursOnly}
                onChange={(e) => setBusinessHoursOnly(e.target.checked)}
              />
              Only send during business hours
            </label>
            {businessHoursOnly ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-[12px] font-semibold">Start</span>
                  <input
                    type="time"
                    className="h-10 w-full rounded-lg border px-3 text-[14px]"
                    value={allowedStartTime}
                    onChange={(e) => setAllowedStartTime(e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[12px] font-semibold">End</span>
                  <input
                    type="time"
                    className="h-10 w-full rounded-lg border px-3 text-[14px]"
                    value={allowedEndTime}
                    onChange={(e) => setAllowedEndTime(e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[12px] font-semibold">Timezone</span>
                  <input
                    className="h-10 w-full rounded-lg border px-3 text-[14px]"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  />
                </label>
              </div>
            ) : null}
          </Card>

          <Card id="cooldown" className="scroll-mt-24 space-y-3 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">Recovery behavior</h2>
            <p className="text-[13px] text-muted-foreground">
              Prevent multiple texts if the same person calls repeatedly.
            </p>
            <label className="block space-y-1.5">
              <span className="text-[12px] font-semibold">Cooldown (minutes)</span>
              <input
                type="number"
                min={0}
                className="h-10 w-full max-w-[200px] rounded-lg border px-3 text-[14px]"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(Number(e.target.value || 0))}
              />
            </label>
          </Card>

          <Card id="replies" className="scroll-mt-24 space-y-3 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">Reply handling</h2>
            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={replyNotifications}
                onChange={(e) => setReplyNotifications(e.target.checked)}
              />
              Route replies to Conversations and notify your team
            </label>
            <Link href="/conversations" className="text-[13px] font-semibold text-primary hover:underline">
              Open Conversations →
            </Link>
          </Card>

          <Card id="exclusions" className="scroll-mt-24 space-y-4 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">Do-not-text list</h2>
            <p className="text-[13px] text-muted-foreground">
              Numbers on this list will not receive missed-call text back messages.
            </p>
            <div className="flex flex-wrap gap-2">
              <input
                className="h-10 min-w-[180px] rounded-lg border px-3 text-[14px]"
                placeholder="Phone number"
                value={exclusionPhone}
                onChange={(e) => setExclusionPhone(e.target.value)}
              />
              <input
                className="h-10 min-w-[200px] rounded-lg border px-3 text-[14px]"
                placeholder="Reason"
                value={exclusionReason}
                onChange={(e) => setExclusionReason(e.target.value)}
              />
              <Button
                variant="outline"
                disabled={exclusionBusy || !exclusionPhone.trim()}
                onClick={async () => {
                  setExclusionBusy(true);
                  try {
                    const res = await fetch("/api/mctb/exclusions", {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        phone: exclusionPhone,
                        reason: exclusionReason,
                      }),
                    });
                    if (!res.ok) return;
                    setExclusionPhone("");
                    await loadExclusions();
                  } finally {
                    setExclusionBusy(false);
                  }
                }}
              >
                Add number
              </Button>
            </div>
            {exclusions.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No exclusions yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border text-[13px]">
                {exclusions.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div>
                      <p className="font-semibold text-[#111827]">{fmtPhone(row.phone)}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {row.reason || "Excluded"}
                        {row.source === "personal_blocked" ? " · personal block" : ""}
                      </p>
                    </div>
                    {row.source === "mctb_exclusion" ? (
                      <button
                        type="button"
                        className="text-[12px] font-semibold text-rose-600 hover:underline"
                        onClick={async () => {
                          const res = await fetch(`/api/mctb/exclusions?id=${row.id}`, {
                            method: "DELETE",
                          });
                          if (!res.ok) return;
                          await loadExclusions();
                        }}
                      >
                        Remove
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card id="test" className="scroll-mt-24 space-y-3 p-5">
            <h2 className="text-[15px] font-semibold text-[#111827]">Test</h2>
            <p className="text-[13px] text-muted-foreground">
              Each consent mode has its own runtime path. Save your selection above, then run the
              test that matches your current mode.
            </p>
            {consentMode === MCTB_CONSENT_MODE_EXISTING ? (
              <div className="rounded-lg bg-[#f0fdf4] p-3 text-[12px] text-[#166534]">
                <p className="font-semibold">Test — Already Have Consent</p>
                <p className="mt-1">
                  Call your number and let it ring without answering. You should receive the recovery
                  SMS immediately with no Press-1 audio. Confirm delivery, reply, and STOP/START.
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-[#eff6ff] p-3 text-[12px] text-[#1e40af]">
                <p className="font-semibold">Test — Verified Call Consent</p>
                <p className="mt-1">
                  Publish your consent audio, then call and listen for your recording. Press 1,
                  then confirm the recovery SMS, reply, and STOP/START.
                </p>
              </div>
            )}
            {selectedNumber ? (
              <p className="text-[14px] font-semibold text-[#111827]">
                Test number: {fmtPhone(selectedNumber.e164)}
              </p>
            ) : (
              <p className="text-[13px] text-rose-600">Select a number above before testing.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={!selectedNumber || saving}
                onClick={() => {
                  void fetch("/api/mctb/setup-test", { method: "POST" })
                    .then((res) => res.json())
                    .then((json) => {
                      if (json?.status) {
                        setSetupTest({
                          started: json.status.started,
                          verified: json.status.verified,
                          checks: json.status.checks,
                        });
                      }
                    });
                }}
              >
                Test My Setup
              </Button>
              <Link href="/voice/missed-calls">
                <Button variant="outline">View missed call log</Button>
              </Link>
              <Link href="/voice/consent-log">
                <Button variant="outline">View consent log</Button>
              </Link>
              <Link href="/conversations">
                <Button variant="outline">View conversations</Button>
              </Link>
            </div>
            {setupTest?.started ? (
              <div className="space-y-2 rounded-lg border p-3 text-[12px]">
                <p className="font-semibold text-[#111827]">
                  {setupTest.verified ? "Setup verified" : "Waiting for your test call…"}
                </p>
                {Object.entries(setupTest.checks).map(([key, done]) => (
                  <p key={key} className={done ? "text-emerald-700" : "text-muted-foreground"}>
                    {done ? "✓" : "○"} {key.replace(/([A-Z])/g, " $1")}
                  </p>
                ))}
              </div>
            ) : null}
          </Card>

          {error ? <p className="text-[13px] font-medium text-rose-600">{error}</p> : null}
          {savedWhilePaused ? (
            <MctbPausedNotice
              pauseKind={data?.schedule?.pauseKind}
              pauseUntil={data?.schedule?.pauseUntil}
              variant="saved"
            />
          ) : saved ? (
            <p className="text-[13px] font-medium text-violet-700">Setup saved.</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pb-8">
            <Button disabled={saving} onClick={() => save(true)}>
              {saving
                ? "Saving…"
                : data?.schedule?.paused
                  ? "Save changes"
                  : "Save & activate"}
            </Button>
            <Button variant="outline" disabled={saving} onClick={() => save(false)}>
              {data?.schedule?.paused ? "Save changes (draft)" : "Save draft"}
            </Button>
            <Link href="/voice/schedule" className="text-[13px] text-primary hover:underline">
              Pause or schedule text-backs →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
