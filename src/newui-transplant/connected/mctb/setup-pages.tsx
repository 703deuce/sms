"use client";

import { useEffect, useState } from "react";
import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { ConsentEditor } from "@/newui-transplant/components/mctb/consent-editor";
import { TextBackEditor } from "@/newui-transplant/components/mctb/text-back-editor";
import { ExclusionsTable } from "@/newui-transplant/components/mctb/exclusions-table";
import {
  businessContextFromMctbSetup,
  type MctbSetupGetJson,
} from "@/lib/newui-transplant/adapters/mctb-setup-context";
import { NewUiLegacyEditorPage } from "@/newui-transplant/connected/shared/legacy-editor-page";
import { MctbSetupPhoneView } from "@/components/mctb/setup/setup-phone-view";
import { MctbSetupRecoveryView } from "@/components/mctb/setup/setup-recovery-view";
import { MctbSetupVoicemailEditorView } from "@/components/mctb/setup/setup-voicemail-editor-view";
import { MctbSetupNotificationsView } from "@/components/mctb/setup/setup-notifications-view";
import { MctbSetupLinksView } from "@/components/mctb/setup/setup-links-view";
import { MctbSetupTestView } from "@/components/mctb/setup/setup-test-view";
import { MctbSetupOverview } from "@/components/mctb/setup-overview";

function useMctbSetup(workspaceName: string) {
  const [setup, setSetup] = useState<MctbSetupGetJson | null>(null);
  useEffect(() => {
    fetch("/api/mctb/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setSetup(j as MctbSetupGetJson))
      .catch(() => setSetup(null));
  }, []);
  const business = setup ? businessContextFromMctbSetup(setup, workspaceName) : null;
  return { setup, business };
}

export function NewUiMctbSetupOverviewPage() {
  return (
    <NewUiLegacyEditorPage title="Setup" description="Configure missed call text back for your business.">
      <MctbSetupOverview />
    </NewUiLegacyEditorPage>
  );
}

export function NewUiMctbSetupPhonePage() {
  return (
    <NewUiLegacyEditorPage title="Phone & Forwarding" description="Connect and verify your business line.">
      <MctbSetupPhoneView />
    </NewUiLegacyEditorPage>
  );
}

export function NewUiMctbSetupConsentPage({ workspaceName: _workspaceName }: { workspaceName: string }) {
  return (
    <Page>
      <PageHeader title="Consent" description="How callers give permission to receive recovery texts." />
      <ConsentEditor />
    </Page>
  );
}

export function NewUiMctbSetupTextBackPage({ workspaceName }: { workspaceName: string }) {
  const { setup, business } = useMctbSetup(workspaceName);
  if (!business) {
    return <p className="p-6 text-sm text-muted-foreground">Loading text-back settings…</p>;
  }
  return (
    <Page>
      <PageHeader title="Text Back" description="Recovery message customers receive after a missed call." />
      <TextBackEditor business={business} initialOpener={setup?.config?.messageTemplate} />
    </Page>
  );
}

export function NewUiMctbSetupRecoveryPage() {
  return (
    <NewUiLegacyEditorPage title="Recovery Controls" description="Pause recovery and follow-up rules.">
      <MctbSetupRecoveryView />
    </NewUiLegacyEditorPage>
  );
}

export function NewUiMctbSetupVoicemailPage() {
  return (
    <NewUiLegacyEditorPage title="Voicemail" description="Greeting and behavior for callers who leave a message.">
      <MctbSetupVoicemailEditorView />
    </NewUiLegacyEditorPage>
  );
}

export function NewUiMctbSetupNotificationsPage() {
  return (
    <NewUiLegacyEditorPage title="Notifications" description="Who gets notified about missed calls and replies.">
      <MctbSetupNotificationsView />
    </NewUiLegacyEditorPage>
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
    <NewUiLegacyEditorPage title="Links" description="Booking and request links included in recovery messages.">
      <MctbSetupLinksView />
    </NewUiLegacyEditorPage>
  );
}

export function NewUiMctbSetupTestPage() {
  return (
    <NewUiLegacyEditorPage title="Test & Activate" description="Verify forwarding, consent, and text-back end to end.">
      <MctbSetupTestView />
    </NewUiLegacyEditorPage>
  );
}
