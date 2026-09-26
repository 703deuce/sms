"use client";

import { Page, PageHeader } from "@/newui-transplant/components/app/kit";
import { ConsentEditor } from "@/newui-transplant/components/mctb/consent-editor";
import { TextBackEditor } from "@/newui-transplant/components/mctb/text-back-editor";
import { ExclusionsTable } from "@/newui-transplant/components/mctb/exclusions-table";
import { TransplantMctbSetupPage } from "@/newui-transplant/mirror/routes/mctb/setup/page";
import { TransplantMctbSetupPhonePage } from "@/newui-transplant/mirror/routes/mctb/setup/phone/page";
import { TransplantMctbSetupRecoveryPage } from "@/newui-transplant/mirror/routes/mctb/setup/recovery/page";
import { TransplantMctbSetupVoicemailPage } from "@/newui-transplant/mirror/routes/mctb/setup/voicemail/page";
import { TransplantMctbSetupNotificationsPage } from "@/newui-transplant/mirror/routes/mctb/setup/notifications/page";
import { TransplantMctbSetupLinksPage } from "@/newui-transplant/mirror/routes/mctb/setup/links/page";
import { TransplantMctbSetupTestPage } from "@/newui-transplant/mirror/routes/mctb/setup/test/page";
import { useMctbSetupApi, formatSetupPhoneLine } from "@/newui-transplant/connected/mctb/setup-hooks";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";

export function NewUiMctbSetupOverviewPage() {
  const { business } = useOpusWorkspaceData();
  const { data, loading } = useMctbSetupApi();
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading setup…</p>;
  return (
    <TransplantMctbSetupPage
      wired={{
        businessLine: formatSetupPhoneLine(data?.businessLineE164),
        sender: business?.sender || "—",
        recoveryActive: data?.runtime?.enabled !== false,
      }}
    />
  );
}

export function NewUiMctbSetupPhonePage() {
  const { data, loading, save } = useMctbSetupApi();
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading phone settings…</p>;
  return (
    <TransplantMctbSetupPhonePage
      wired={{
        businessLine: formatSetupPhoneLine(data?.businessLineE164),
        forwardingDestination: formatSetupPhoneLine(data?.productionForwardTargetE164),
        onSave: async () => {
          const phoneNumberId = data?.runtime?.phoneNumberId;
          if (!phoneNumberId) throw new Error("Select a forwarding number before saving.");
          await save({ phoneNumberId, activate: false });
        },
      }}
    />
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

export function NewUiMctbSetupRecoveryPage() {
  return <TransplantMctbSetupRecoveryPage />;
}

export function NewUiMctbSetupVoicemailPage() {
  return <TransplantMctbSetupVoicemailPage />;
}

export function NewUiMctbSetupNotificationsPage() {
  return <TransplantMctbSetupNotificationsPage />;
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
  return <TransplantMctbSetupLinksPage />;
}

export function NewUiMctbSetupTestPage() {
  return <TransplantMctbSetupTestPage />;
}
