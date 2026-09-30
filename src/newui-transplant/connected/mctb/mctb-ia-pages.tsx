"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FeatureEmphasisStrip,
  Page,
  PageHeader,
  Panel,
  Pill,
  Stat,
  TextLink,
} from "@/newui-transplant/components/app/kit";
import {
  Activity,
  Bell,
  MessageSquareText,
  PauseCircle,
  PhoneForwarded,
  PlayCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useMctbSetupPhoneWiring } from "@/newui-transplant/connected/mctb/mctb-setup-phone-wiring";
import { OpusLineTabs } from "@/newui-transplant/components/app/segmented-nav";
import { useMctbRecoveryWiring } from "@/newui-transplant/connected/mctb/setup-wiring-hooks";
import { TextBackEditor } from "@/newui-transplant/components/mctb/text-back-editor";
import { MctbBookingLinkSection } from "@/newui-transplant/components/mctb/mctb-booking-link-section";
import { ConsentEditor } from "@/newui-transplant/components/mctb/consent-editor";
import { ExclusionsTable } from "@/newui-transplant/components/mctb/exclusions-table";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import {
  NewUiMctbSetupRecoveryPage,
  NewUiMctbSetupMissedCallRulesPage,
  NewUiMctbSetupNotificationsPage,
  NewUiMctbSetupPhonePage,
  NewUiMctbSetupTestPage,
} from "@/newui-transplant/connected/mctb/setup-pages";
import { NewUiMctbVoicemailMessagesPanel } from "@/newui-transplant/connected/mctb/voicemail-messages-panel";
import { NewUiMctbVoicemailGreetingPanel } from "@/newui-transplant/connected/mctb/voicemail-greeting-panel";
import { fetchMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/newui-transplant/components/ui/dialog";

function useTabParam(name: string, allowed: string[], fallback: string) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const raw = searchParams.get(name) || fallback;
  const tab = allowed.includes(raw) ? raw : fallback;

  const setTab = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(name, next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, name],
  );

  return { tab, setTab };
}

export function NewUiMctbMissedCallRecoveryPage() {
  const { tab, setTab } = useTabParam("tab", ["general", "rules", "consent", "exclusions"], "general");
  const recovery = useMctbRecoveryWiring();
  const [usageUsed, setUsageUsed] = useState<number | null>(null);
  const [usageLimit, setUsageLimit] = useState<number | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    setUsageError(null);
    void fetchMctbSetup({ force: true })
      .then((data) => {
        const caps = data.capabilities as {
          monthlyRecoveryLimit?: number;
          monthlyRecoveryUsed?: number;
        };
        const limit = Number(caps?.monthlyRecoveryLimit ?? 0);
        const used = Number(caps?.monthlyRecoveryUsed ?? 0);
        if (limit > 0) {
          setUsageLimit(limit);
          setUsageUsed(used);
        }
      })
      .catch((e) => {
        setUsageError(e instanceof Error ? e.message : "Could not load usage");
      });
  }, []);

  const paused = recovery.paused;

  return (
    <Page>
      <PageHeader
        title="Missed-Call Recovery"
        description="When unanswered calls should trigger recovery texts, consent, and exclusions."
        status={
          <Pill tone={paused ? "warning" : "success"}>{paused ? "Paused" : "Running"}</Pill>
        }
      />
      {usageError ? (
        <p className="mb-3 text-sm text-destructive" role="alert">{usageError}</p>
      ) : null}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="Recovery"
          value={paused ? "Paused" : "Running"}
          hint={paused ? "Texts stopped" : "Automated texts on"}
          icon={paused ? PauseCircle : PlayCircle}
        />
        {usageLimit != null && usageUsed != null ? (
          <Stat
            label="This month"
            value={`${usageUsed}`}
            hint={`of ${usageLimit} recoveries`}
            icon={Activity}
          />
        ) : null}
        <Stat
          label="Follow-up"
          value={`${recovery.maxMessages}`}
          hint="Max texts per caller"
          icon={MessageSquareText}
        />
      </div>
      <div className="mb-4">
        <FeatureEmphasisStrip
          icon={paused ? PauseCircle : PlayCircle}
          title={paused ? "Recovery is paused" : "Recovery is running"}
          badge={
            <Pill tone={paused ? "warning" : "success"} dot={false} className="ring-0">
              {paused ? "Paused" : "Active"}
            </Pill>
          }
          description={
            paused
              ? "Forwarded calls can still reach voicemail. No automated recovery texts until you resume."
              : "Qualifying missed calls receive recovery texts after your delay and consent rules."
          }
          action={<TextLink href={`${MCTB_ROUTES.missedCallRecovery}?tab=rules`}>Edit rules</TextLink>}
        />
      </div>
      <OpusLineTabs
        label="Missed-call recovery sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "general", label: "General" },
          { value: "rules", label: "Rules" },
          { value: "consent", label: "Consent" },
          { value: "exclusions", label: "Exclusions" },
        ]}
      />
      {tab === "general" ? (
        <div
          id="opus-tabpanel-general"
          role="tabpanel"
          aria-labelledby="opus-tab-general"
          className="mt-4"
        >
          <NewUiMctbSetupRecoveryPage />
        </div>
      ) : null}
      {tab === "rules" ? (
        <div id="opus-tabpanel-rules" role="tabpanel" aria-labelledby="opus-tab-rules" className="mt-4">
          <NewUiMctbSetupMissedCallRulesPage embedded />
        </div>
      ) : null}
      {tab === "consent" ? (
        <div id="opus-tabpanel-consent" role="tabpanel" aria-labelledby="opus-tab-consent" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <ButtonLink href={MCTB_ROUTES.complianceConsent} variant="outline" size="sm">
              View consent history
            </ButtonLink>
          </div>
          <ConsentEditor />
        </div>
      ) : null}
      {tab === "exclusions" ? (
        <div id="opus-tabpanel-exclusions" role="tabpanel" aria-labelledby="opus-tab-exclusions" className="mt-4">
          <ExclusionsTable />
        </div>
      ) : null}
    </Page>
  );
}

export function NewUiMctbTextBackPage() {
  const searchParams = useSearchParams();
  const section = searchParams.get("section");
  const bookingRef = useMemo(() => (section === "booking" ? "booking-link" : undefined), [section]);
  const [textBackMeta, setTextBackMeta] = useState({
    consentLabel: "—",
    senderReady: false,
    segments: 1,
  });

  useEffect(() => {
    if (bookingRef && typeof document !== "undefined") {
      document.getElementById(bookingRef)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [bookingRef]);

  const refreshTextBackMeta = useCallback(() => {
    void fetchMctbSetup({ force: true })
      .then((data) => {
        const consent =
          data.consentMode === "existing_consent" ? "Existing permission" : "Press 1";
        const ready = Boolean(data.compliance?.messagingReady);
        const opener = String(data.runtime?.messageTemplate ?? "");
        const segments = Math.max(1, Math.ceil(opener.length / 160));
        setTextBackMeta({ consentLabel: consent, senderReady: ready, segments });
      })
      .catch(() => {
        setTextBackMeta({ consentLabel: "—", senderReady: false, segments: 1 });
      });
  }, []);

  useEffect(() => {
    refreshTextBackMeta();
    const onSetup = () => refreshTextBackMeta();
    window.addEventListener("mctb-setup-updated", onSetup);
    return () => window.removeEventListener("mctb-setup-updated", onSetup);
  }, [refreshTextBackMeta]);

  return (
    <Page>
      <PageHeader
        title="Text Back"
        description="Recovery message and booking link callers receive after a missed call."
        status={<Pill tone="primary">Customer-facing</Pill>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Consent mode" value={textBackMeta.consentLabel} hint="Recovery permission" icon={ShieldCheck} />
        <Stat
          label="Sender"
          value={textBackMeta.senderReady ? "Ready" : "Needs attention"}
          hint="Text-back number"
          icon={PhoneForwarded}
        />
        <Stat
          label="Opener size"
          value={`${textBackMeta.segments}`}
          hint={`segment${textBackMeta.segments === 1 ? "" : "s"} (est.)`}
          icon={MessageSquareText}
        />
      </div>
      <div className="mb-4">
        <FeatureEmphasisStrip
          icon={MessageSquareText}
          title="Two-message sequence when Press 1 is on"
          badge={<Pill tone="info" dot={false} className="ring-0">Preview matches send order</Pill>}
          description="Compliance confirmation first, then your conversation opener. Existing-permission mode skips the compliance bubble in preview when not applicable."
          action={<TextLink href={`${MCTB_ROUTES.missedCallRecovery}?tab=consent`}>Edit consent</TextLink>}
        />
      </div>
      <div className="flex flex-col gap-6">
        <TextBackEditor manageSenderHref={MCTB_ROUTES.phone} />
        <Panel
          id="booking-link"
          className="border-primary/15 shadow-[0_8px_24px_-12px_rgba(88,28,135,0.25)]"
          title="Booking link"
          description="Optional link inserted as {booking_link} in your recovery message."
        >
          <MctbBookingLinkSection />
        </Panel>
      </div>
    </Page>
  );
}

export function NewUiMctbNotificationsDirectPage() {
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [urgentOn, setUrgentOn] = useState(false);

  const refreshHandoffMeta = useCallback(() => {
    void fetch("/api/mctb/handoff", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return;
        const json = await r.json();
        const data = json.data ?? json;
        const recipients = Array.isArray(data.recipients) ? data.recipients : [];
        setRecipientCount(recipients.length);
        setUrgentOn(Boolean(data.config?.emergencyDetectionEnabled));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshHandoffMeta();
    const onHandoff = () => refreshHandoffMeta();
    window.addEventListener("mctb-handoff-updated", onHandoff);
    return () => window.removeEventListener("mctb-handoff-updated", onHandoff);
  }, [refreshHandoffMeta]);

  return (
    <Page>
      <PageHeader
        title="Notifications"
        description="Where your team is notified when callers reply or urgent messages are detected."
        status={<Pill tone="info">Team alerts</Pill>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="Recipients"
          value={recipientCount == null ? "—" : String(recipientCount)}
          hint="Team members"
          icon={Users}
        />
        <Stat
          label="Urgent detection"
          value={urgentOn ? "On" : "Off"}
          hint="Semantic reply alerts"
          icon={Bell}
        />
        <Stat label="Channels" value="Email + SMS" hint="Per event below" icon={Activity} />
      </div>
      <div className="mb-4">
        <FeatureEmphasisStrip
          icon={Bell}
          title="Know when customers need you"
          badge={<Pill tone={urgentOn ? "warning" : "neutral"} dot={false} className="ring-0">
            {urgentOn ? "Urgent rules on" : "Urgent rules off"}
          </Pill>}
          description="Reply and voicemail events notify your team. Urgent Reply Alerts classify inbound messages before alerts fire."
        />
      </div>
      <NewUiMctbSetupNotificationsPage />
    </Page>
  );
}

export function NewUiMctbPhoneForwardingPage() {
  const searchParams = useSearchParams();
  const testOpen = searchParams.get("test") === "1";
  const [testDialog, setTestDialog] = useState(testOpen);
  const { wired: phoneWired, loading: phoneMetaLoading } = useMctbSetupPhoneWiring();

  useEffect(() => {
    setTestDialog(testOpen);
  }, [testOpen]);

  const verificationTone = phoneWired?.verificationPillTone ?? "warning";
  const verificationLabel = phoneWired?.verificationPillLabel ?? "Loading…";
  const businessLine = phoneWired?.businessLine ?? "—";
  const senderTitle = phoneWired?.senderOptions?.find((o) => o.active)?.title ?? "—";

  return (
    <>
      <Page>
        <PageHeader
          title="Phone & Forwarding"
          description="Business line, call forwarding, text-back sender, and connection test."
          status={
            phoneMetaLoading ? (
              <Pill tone="neutral">Loading</Pill>
            ) : (
              <Pill tone={verificationTone}>{verificationLabel}</Pill>
            )
          }
          actions={
            <ButtonLink href={`${MCTB_ROUTES.phone}?test=1`} variant="outline" size="sm">
              Test connection
            </ButtonLink>
          }
        />
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Business line" value={phoneMetaLoading ? "…" : businessLine} hint="Public number" icon={PhoneForwarded} />
          <Stat
            label="Forwarding"
            value={verificationTone === "success" ? "Verified" : "Not verified"}
            hint="Carrier path to Transovo"
            icon={Activity}
          />
          <Stat label="Active sender" value={phoneMetaLoading ? "…" : senderTitle} hint="Recovery texts" icon={MessageSquareText} />
        </div>
        <div className="mb-4">
          <FeatureEmphasisStrip
            icon={PhoneForwarded}
            title={verificationTone === "success" ? "Calls reach Transovo when you miss them" : "Verify forwarding to go live"}
            badge={
              <Pill tone={verificationTone} dot={false} className="ring-0">
                {verificationLabel}
              </Pill>
            }
            description="Your business line stays public. Unanswered calls forward to Transovo for recovery texts and voicemail."
            action={
              verificationTone !== "success" ? (
                <TextLink href={`${MCTB_ROUTES.phone}?test=1`}>Test connection</TextLink>
              ) : undefined
            }
          />
        </div>
        <NewUiMctbSetupPhonePage />
      </Page>
      <Dialog open={testDialog} onOpenChange={setTestDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Test connection</DialogTitle>
          </DialogHeader>
          <NewUiMctbSetupTestPage />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NewUiMctbVoicemailCombinedPage({ numberId }: { numberId?: string }) {
  const { tab, setTab } = useTabParam("tab", ["messages", "greeting"], "messages");

  return (
    <Page>
      <PageHeader
        title="Voicemail"
        description="Listen to messages and manage your greeting."
        actions={
          <ButtonLink href={MCTB_ROUTES.setupVoicemail} variant="outline" size="sm">
            Voicemail settings
          </ButtonLink>
        }
      />
      <OpusLineTabs
        label="Voicemail sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "messages", label: "Messages" },
          { value: "greeting", label: "Greeting" },
        ]}
      />
      {tab === "messages" ? (
        <div
          id="opus-tabpanel-messages"
          role="tabpanel"
          aria-labelledby="opus-tab-messages"
          className="mt-4"
        >
          <NewUiMctbVoicemailMessagesPanel numberId={numberId} />
        </div>
      ) : null}
      {tab === "greeting" ? (
        <div
          id="opus-tabpanel-greeting"
          role="tabpanel"
          aria-labelledby="opus-tab-greeting"
          className="mt-4"
        >
          <NewUiMctbVoicemailGreetingPanel />
        </div>
      ) : null}
    </Page>
  );
}
