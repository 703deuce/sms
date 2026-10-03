"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { MctbCapabilities } from "@/lib/mctb/capabilities";
import type { CarrierForwardingGuide } from "@/lib/mctb/onboarding/carriers";
import type {
  MctbConsentMode,
  MctbForwardingCarrier,
  MctbOnboardingStep,
} from "@/lib/mctb/onboarding/types";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { getRecoveryGoalDefinition, type MctbRecoveryGoalId } from "@/lib/mctb/recovery-goals";
import type { MctbNumberDrawerMode } from "@/newui-transplant/components/mctb/number-drawer-opus";
import { MctbNumberDrawerOpus } from "@/newui-transplant/components/mctb/number-drawer-opus";
import { EmptyState, Panel } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import {
  MctbOnboardingWizardFooterProvider,
  MctbOnboardingWizardShell,
  type WizardFooterConfig,
} from "@/newui-transplant/connected/mctb/mctb-onboarding-wizard-shell";
import {
  WizardBusinessStep,
  WizardConnectPhoneStep,
  WizardConsentStep,
  WizardNotificationsStep,
  WizardTestStep,
  WizardTextBackStep,
  WizardVoicemailStep,
} from "@/newui-transplant/connected/mctb/mctb-onboarding-wizard-steps";

export type MctbOnboardingController = {
  data: {
    state: {
      currentStep: string;
      forwardingTestStartedAt?: string | null;
      voicemailConfiguredAt?: string | null;
    };
    trialNumber: {
      provisioned: boolean;
      display: string | null;
      tfvStatusLabel: string;
      messagingVerificationStatus: string;
      phoneNumberId?: string | null;
    };
    carriers: CarrierForwardingGuide[];
    forwardingVerification: {
      testStarted: boolean;
      callDetected?: boolean;
      verified: boolean;
    } | null;
    liveTest: { passed: boolean; checks: Record<string, boolean> };
    tfv: { status: string; approved: boolean; failureReason?: string | null };
    trial?: { daysRemaining?: number };
    workspaceIngress?: {
      phoneNumberId?: string;
      e164?: string;
      forwardTargetE164?: string | null;
    };
  } | null;
  saving: boolean;
  error: string | null;
  setError: (message: string | null) => void;
  existingConsentEligible: boolean;
  businessName: string;
  setBusinessName: (v: string) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
  businessNumber: string;
  setBusinessNumber: (v: string) => void;
  carrier: MctbForwardingCarrier;
  setCarrier: (c: MctbForwardingCarrier) => void;
  messageTemplate: string;
  setMessageTemplate: (v: string) => void;
  recoveryGoal: MctbRecoveryGoalId;
  setRecoveryGoal: (id: MctbRecoveryGoalId) => void;
  consentMode: MctbConsentMode;
  setConsentMode: (m: MctbConsentMode) => void;
  existingConsentAttested: boolean;
  setExistingConsentAttested: (v: boolean) => void;
  forwardRingSeconds: number;
  setForwardRingSeconds: (n: number) => void;
  setForwardingTestActive: (v: boolean) => void;
  drawerMode: MctbNumberDrawerMode;
  setDrawerMode: (m: MctbNumberDrawerMode) => void;
  step: MctbOnboardingStep;
  stageIndex: number;
  load: () => Promise<void>;
  post: (body: Record<string, unknown>) => Promise<unknown>;
  previousStep: MctbOnboardingStep | null;
  forwardE164: string | null | undefined;
  forwardDisplay: string;
  tfvApproved: boolean;
  usesA2pPath: boolean;
  router: ReturnType<typeof useRouter>;
  presentation: "page" | "modal";
  onFinished?: () => void;
  capabilities: MctbCapabilities | null;
  senderPresentation: { title: string; description: string } | null;
};

export function MctbOnboardingOpusView({ controller: c }: { controller: MctbOnboardingController }) {
  const [footer, setFooter] = useState<WizardFooterConfig | null>(null);
  const onBack = useCallback(() => {
    if (c.previousStep) void c.post({ step: c.previousStep });
  }, [c]);

  if (c.step === "ready") {
    const messagingPending = !c.tfvApproved;
    const inModal = c.presentation === "modal";
    return (
      <div
        className={
          inModal
            ? "flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-10"
            : "mx-auto w-full max-w-3xl px-4 py-8"
        }
      >
        <Panel className={inModal ? "w-full max-w-lg" : undefined}>
          <EmptyState
            icon={CheckCircle2}
            title="You're ready"
            description={
              messagingPending
                ? "Call handling is ready. Messaging verification is still pending — automatic recovery texts will send when approved."
                : "Your missed-call recovery is active."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (inModal && c.onFinished) c.onFinished();
                    else c.router.push(MCTB_ROUTES.home);
                  }}
                >
                  Go to Overview
                </Button>
                {!inModal ? (
                  <Button type="button" variant="outline" asChild>
                    <Link href={MCTB_ROUTES.phone}>Review phone &amp; forwarding</Link>
                  </Button>
                ) : null}
              </div>
            }
          />
        </Panel>
      </div>
    );
  }

  const stepContent = (
    <>
      {c.error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {c.error}
        </p>
      ) : null}
      {c.step === "business_line" ? <WizardBusinessStep c={c} /> : null}
      {c.step === "consent" ? <WizardConsentStep c={c} /> : null}
      {c.step === "recovery" ? <WizardTextBackStep c={c} /> : null}
      {c.step === "voicemail" ? <WizardVoicemailStep c={c} /> : null}
      {c.step === "notifications" ? <WizardNotificationsStep c={c} caps={c.capabilities} /> : null}
      {c.step === "connect_calls" ? <WizardConnectPhoneStep c={c} /> : null}
      {c.step === "review_test" ? <WizardTestStep c={c} /> : null}
    </>
  );

  const modalLayout = c.presentation === "modal";

  return (
    <div className={modalLayout ? "flex h-full min-h-0 flex-1 flex-col overflow-hidden" : undefined}>
    <MctbOnboardingWizardFooterProvider onFooterChange={setFooter}>
      <MctbOnboardingWizardShell
        presentation={c.presentation}
        stageIndex={c.stageIndex}
        saving={c.saving}
        onBack={onBack}
        footer={footer}
      >
        {stepContent}
      </MctbOnboardingWizardShell>
      <MctbNumberDrawerOpus
        open={c.drawerMode}
        onClose={() => c.setDrawerMode(null)}
        onOpenMode={c.setDrawerMode}
        onNumbersChanged={() => void c.load()}
      />
    </MctbOnboardingWizardFooterProvider>
    </div>
  );
}
