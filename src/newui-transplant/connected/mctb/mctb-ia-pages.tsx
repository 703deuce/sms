"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { OpusStatusAnchor, Page, PageHeader, Panel } from "@/newui-transplant/components/app/kit";
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
  const [usageLine, setUsageLine] = useState<string | null>(null);

  useEffect(() => {
    void fetchMctbSetup()
      .then((data) => {
        const caps = data.capabilities as {
          monthlyRecoveryLimit?: number;
          monthlyRecoveryUsed?: number;
        };
        const limit = Number(caps?.monthlyRecoveryLimit ?? 0);
        const used = Number(caps?.monthlyRecoveryUsed ?? 0);
        if (limit > 0) setUsageLine(`${used} of ${limit} recoveries this month`);
      })
      .catch(() => undefined);
  }, []);

  return (
    <Page>
      <PageHeader
        title="Missed-Call Recovery"
        description="When unanswered calls should trigger recovery texts, consent, and exclusions."
      />
      <div className="mb-4 flex flex-col gap-3">
        <OpusStatusAnchor
          label="Recovery"
          status={recovery.paused ? "Paused" : "Running"}
          tone={recovery.paused ? "warning" : "success"}
        >
          {usageLine ? (
            <>
              <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
              <span className="text-muted-foreground">Usage</span>
              <span className="font-medium tabular-nums">{usageLine}</span>
            </>
          ) : null}
        </OpusStatusAnchor>
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

  useEffect(() => {
    if (bookingRef && typeof document !== "undefined") {
      document.getElementById(bookingRef)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [bookingRef]);

  return (
    <Page>
      <PageHeader
        title="Text Back"
        description="Recovery message and booking link callers receive after a missed call."
      />
      <div className="flex flex-col gap-6">
        <TextBackEditor manageSenderHref={MCTB_ROUTES.phone} />
        <Panel
          id="booking-link"
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
  return (
    <Page>
      <PageHeader
        title="Notifications"
        description="Where your team is notified when callers reply or urgent messages are detected."
      />
      <NewUiMctbSetupNotificationsPage />
    </Page>
  );
}

export function NewUiMctbPhoneForwardingPage() {
  const searchParams = useSearchParams();
  const testOpen = searchParams.get("test") === "1";
  const [testDialog, setTestDialog] = useState(testOpen);

  useEffect(() => {
    setTestDialog(testOpen);
  }, [testOpen]);

  return (
    <>
      <Page>
        <PageHeader
          title="Phone & Forwarding"
          description="Business line, call forwarding, text-back sender, and connection test."
          actions={
            <ButtonLink href={`${MCTB_ROUTES.phone}?test=1`} variant="outline" size="sm">
              Test connection
            </ButtonLink>
          }
        />
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
