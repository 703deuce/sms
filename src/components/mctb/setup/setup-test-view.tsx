"use client";

import { Button } from "@/components/ui/button";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import { MctbCallout } from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import { MctbVerificationTimeline } from "@/components/mctb/wizard/mctb-wizard-ui";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { MctbSetupTestStatus } from "@/lib/mctb/setup-test";
import type { LiveTestStatus } from "@/lib/mctb/onboarding/live-test";
import { Phone, Radio, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SECTION_TITLE = "text-[15px] font-semibold tracking-tight text-foreground";

export function MctbSetupTestView() {
  const [setupTest, setSetupTest] = useState<MctbSetupTestStatus | null>(null);
  const [liveTest, setLiveTest] = useState<LiveTestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingSetupTest, setStartingSetupTest] = useState(false);
  const [startingLiveTest, setStartingLiveTest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSetupTest = useCallback(async () => {
    const res = await fetch("/api/mctb/setup-test");
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.status) setSetupTest(json.status);
  }, []);

  const refreshLiveTest = useCallback(async () => {
    const res = await fetch("/api/mctb/live-test");
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.data) setLiveTest(json.data);
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    await Promise.all([refreshSetupTest(), refreshLiveTest()]);
  }, [refreshSetupTest, refreshLiveTest]);

  useEffect(() => {
    void refreshAll().finally(() => setLoading(false));
  }, [refreshAll]);

  useEffect(() => {
    const active = setupTest?.started || (liveTest?.started && !liveTest?.passed);
    if (!active) return;
    const timer = setInterval(() => void refreshAll(), 3000);
    return () => clearInterval(timer);
  }, [setupTest?.started, liveTest?.started, liveTest?.passed, refreshAll]);

  async function startSetupTest() {
    setStartingSetupTest(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/setup-test", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not start setup test");
      if (json.status) setSetupTest(json.status);
      else await refreshSetupTest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start setup test");
    } finally {
      setStartingSetupTest(false);
    }
  }

  async function startLiveTest() {
    setStartingLiveTest(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/live-test", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not start live test");
      if (json.data) setLiveTest(json.data);
      else await refreshLiveTest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start live test");
    } finally {
      setStartingLiveTest(false);
    }
  }

  const setupNumber =
    setupTest?.assignedNumberE164?.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "1-$1-$2-$3") ||
    "your MCTB number";
  const liveForward =
    liveTest?.forwardTargetE164?.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "1-$1-$2-$3") ||
    "your forwarding destination";
  const liveBusiness =
    liveTest?.businessNumberE164?.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "1-$1-$2-$3") ||
    "your business line";

  if (loading) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner">
          <div className="ref-card p-12 text-center text-sm text-muted-foreground">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <MctbSetupSectionLayout
      title="Test & diagnostics"
      description="Validate missed-call recovery on production paths: assigned MCTB number, then your forwarded business line."
      showSave={false}
      error={error}
    >
      <MctbCallout icon={Zap} title="Production path test" variant="success">
        Call your assigned MCTB number ({setupNumber}) directly. Validates workspace routing, consent
        mode, missed-call event creation, and SMS delivery on the production ingress.
      </MctbCallout>

      <div className="ref-card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={SECTION_TITLE}>Setup test checkpoints</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {setupTest?.started
                ? setupTest.verified
                  ? "Verified — production path is working."
                  : "Waiting for call activity on your assigned number…"
                : "Start a session, then call your assigned MCTB number and let it ring unanswered."}
            </p>
          </div>
          {!setupTest?.started || setupTest.verified ? (
            <Button
              variant={setupTest?.verified ? "outline" : "default"}
              size="sm"
              disabled={startingSetupTest}
              onClick={() => void startSetupTest()}
            >
              {setupTest?.verified ? "Run again" : "Start setup test"}
            </Button>
          ) : null}
        </div>

        {setupTest?.started ? (
          <MctbVerificationTimeline
            title="Setup test sequence"
            passed={setupTest.verified}
            passedTitle="Production path verified"
            steps={[
              { id: "did", label: "Call reached MCTB number", done: setupTest.checks.transovoDidReceived },
              { id: "ws", label: "Workspace resolved", done: setupTest.checks.workspaceResolved },
              { id: "mode", label: "Consent mode loaded", done: setupTest.checks.consentModeLoaded },
              { id: "greeting", label: "Greeting played", done: setupTest.checks.greetingPlayed },
              ...(setupTest.consentMode === "press_1"
                ? [{ id: "p1", label: "Press 1 received", done: setupTest.checks.press1Received }]
                : []),
              { id: "consent", label: "Consent recorded", done: setupTest.checks.consentRecorded },
              { id: "event", label: "Missed call event created", done: setupTest.checks.missedCallEventCreated },
              { id: "queue", label: "Recovery SMS queued", done: setupTest.checks.smsQueued },
              { id: "provider", label: "SMS accepted by provider", done: setupTest.checks.smsProviderAccepted },
            ]}
          />
        ) : null}
        {setupTest?.failureReason ? (
          <p className="text-[13px] text-amber-800">{setupTest.failureReason}</p>
        ) : null}
      </div>

      <MctbCallout icon={Radio} title="Forwarded business line test">
        Call {liveBusiness} from another phone and don&apos;t answer. Transovo should receive the
        forward on {liveForward}, classify the miss, and send recovery SMS.
      </MctbCallout>

      <div className="ref-card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={SECTION_TITLE}>Live forward test</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {liveTest?.passed
                ? "Live test passed — forwarding and recovery are working."
                : liveTest?.started
                  ? "Waiting for your forwarded test call…"
                  : "Requires carrier forwarding to your MCTB number."}
            </p>
          </div>
          {!liveTest?.started || liveTest.passed ? (
            <Button
              variant={liveTest?.passed ? "outline" : "default"}
              size="sm"
              disabled={startingLiveTest}
              onClick={() => void startLiveTest()}
            >
              {liveTest?.passed ? "Run again" : "Start live test"}
            </Button>
          ) : null}
        </div>

        {liveTest?.started ? (
          <MctbVerificationTimeline
            title="Live forward test"
            passed={liveTest.passed}
            passedTitle="Forwarding and recovery verified"
            waitingHint={`Call ${liveBusiness} and let it forward to ${liveForward}.`}
            steps={[
              { id: "call", label: "Call arrived on MCTB number", done: liveTest.checks.callDetected },
              { id: "missed", label: "Classified as missed call", done: liveTest.checks.missedCall },
              { id: "consent", label: "Consent completed (if required)", done: liveTest.checks.consentCompleted },
              { id: "sent", label: "Recovery SMS sent", done: liveTest.checks.textSent },
              { id: "delivered", label: "SMS delivered", done: liveTest.checks.textDelivered },
              { id: "reply", label: "Reply received in inbox", done: liveTest.checks.replyReceived },
            ]}
          />
        ) : null}
      </div>

      <MctbCallout icon={Phone} title="After testing">
        Verify carrier forwarding in{" "}
        <Link href={MCTB_ROUTES.setupPhone} className="font-semibold text-primary hover:underline">
          Phone & Forwarding
        </Link>
        . Review consent and recovery goal in{" "}
        <Link href={MCTB_ROUTES.setupTextBack} className="font-semibold text-primary hover:underline">
          Text Back
        </Link>{" "}
        before activating recovery.
      </MctbCallout>
    </MctbSetupSectionLayout>
  );
}
