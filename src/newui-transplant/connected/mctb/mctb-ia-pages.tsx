"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/newui-transplant/components/ui/tabs";
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
      {usageLine ? (
        <p className="mb-3 text-sm text-muted-foreground">Usage: {usageLine}</p>
      ) : null}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" aria-label="Missed-call recovery sections">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="consent">Consent</TabsTrigger>
          <TabsTrigger value="exclusions">Exclusions</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="mt-4">
          <p className="mb-4 text-sm text-muted-foreground">
            Unanswered calls can still reach Transovo voicemail, but recovery texts are paused while recovery is
            paused.
          </p>
          <NewUiMctbSetupRecoveryPage />
        </TabsContent>
        <TabsContent value="rules" className="mt-4">
          <NewUiMctbSetupMissedCallRulesPage embedded />
        </TabsContent>
        <TabsContent value="consent" className="mt-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <ButtonLink href={MCTB_ROUTES.complianceConsent} variant="outline" size="sm">
              View consent history
            </ButtonLink>
          </div>
          <ConsentEditor />
        </TabsContent>
        <TabsContent value="exclusions" className="mt-4">
          <ExclusionsTable />
        </TabsContent>
      </Tabs>
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
      <div className="flex flex-col gap-8">
        <section aria-labelledby="text-back-message">
          <h2 id="text-back-message" className="text-sm font-medium">Message</h2>
          <div className="mt-3 border-t pt-4">
            <TextBackEditor manageSenderHref={MCTB_ROUTES.phone} />
          </div>
        </section>
        <section id="booking-link" aria-labelledby="text-back-booking">
          <h2 id="text-back-booking" className="text-sm font-medium">Booking link</h2>
          <div className="mt-3 border-t pt-4">
            <MctbBookingLinkSection />
          </div>
        </section>
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
      <PageHeader title="Voicemail" description="Listen to messages and manage your greeting." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="line" aria-label="Voicemail sections">
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="greeting">Greeting</TabsTrigger>
        </TabsList>
        <TabsContent value="messages" className="mt-4">
          <NewUiMctbVoicemailMessagesPanel numberId={numberId} />
        </TabsContent>
        <TabsContent value="greeting" className="mt-4">
          <NewUiMctbVoicemailGreetingPanel />
        </TabsContent>
      </Tabs>
    </Page>
  );
}
