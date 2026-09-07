"use client";

import { Button } from "@/components/ui/button";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import {
  MctbCallout,
  MctbCheckpointList,
  MctbHeroNumber,
  MctbOptionCard,
} from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { TryItStatus } from "@/lib/mctb/try-it/types";
import type { MctbSetupTestStatus } from "@/lib/mctb/setup-test";
import type { LiveTestStatus } from "@/lib/mctb/onboarding/live-test";
import { Phone, Radio, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SECTION_TITLE = "text-[15px] font-semibold tracking-tight text-foreground";

export function MctbSetupTestView() {
  const [consentMode, setConsentMode] = useState<MctbConsentMode>("press_1");
  const [existingConsentAttested, setExistingConsentAttested] = useState(false);
  const [tryItStatus, setTryItStatus] = useState<TryItStatus | null>(null);
  const [setupTest, setSetupTest] = useState<MctbSetupTestStatus | null>(null);
  const [liveTest, setLiveTest] = useState<LiveTestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingTryIt, setStartingTryIt] = useState(false);
  const [startingSetupTest, setStartingSetupTest] = useState(false);
  const [startingLiveTest, setStartingLiveTest] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshTryIt = useCallback(async () => {
    const res = await fetch("/api/mctb/try-it");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || "Failed to load demo test status");
      return;
    }
    setTryItStatus(json.data);
    if (json.data?.consentMode) setConsentMode(json.data.consentMode);
  }, []);

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
    await Promise.all([refreshTryIt(), refreshSetupTest(), refreshLiveTest()]);
  }, [refreshTryIt, refreshSetupTest, refreshLiveTest]);

  useEffect(() => {
    void refreshAll().finally(() => setLoading(false));
  }, [refreshAll]);

  useEffect(() => {
    const active =
      tryItStatus?.sessionActive ||
      setupTest?.started ||
      (liveTest?.started && !liveTest?.passed);
    if (!active) return;
    const timer = setInterval(() => void refreshAll(), 3000);
    return () => clearInterval(timer);
  }, [tryItStatus?.sessionActive, setupTest?.started, liveTest?.started, liveTest?.passed, refreshAll]);

  async function startTryIt() {
    setStartingTryIt(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/try-it", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentMode,
          existingConsentAttested,
          context: "try_it",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not start demo test");
      await refreshTryIt();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start demo test");
    } finally {
      setStartingTryIt(false);
    }
  }

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

  const demoDisplay = tryItStatus?.demoNumberDisplay || "—";
  const showPress1 = consentMode === "press_1";
  const tryItStarted = Boolean(tryItStatus?.sessionActive || tryItStatus?.completed);
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
      description="Validate missed-call recovery on the same Telnyx paths as production — demo line, assigned number, then forwarded business line."
      showSave={false}
      error={error}
    >
      <MctbCallout icon={Sparkles} title="Demo test (no forwarding)">
        Call your workspace demo line from your verified mobile. Use this before carrier forwarding is
        configured.
      </MctbCallout>

      <div className="ref-card space-y-5 p-5 sm:p-6">
        <div>
          <h2 className={SECTION_TITLE}>1. Choose consent mode for demo test</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <MctbOptionCard
              selected={consentMode === "press_1"}
              disabled={tryItStarted && !tryItStatus?.expired}
              title="Ask callers to press 1"
              description="Hear the disclosure, press 1, receive compliance confirmation, then recovery text."
              onClick={() => setConsentMode("press_1")}
            />
            <MctbOptionCard
              selected={consentMode === "existing_consent"}
              disabled={tryItStarted && !tryItStatus?.expired}
              title="Use permission my business already has"
              description="No Press-1 interaction. Recovery text sends after the missed-call path completes."
              onClick={() => setConsentMode("existing_consent")}
            />
          </div>
          {consentMode === "existing_consent" ? (
            <label className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-[13px]">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={existingConsentAttested}
                disabled={tryItStarted && !tryItStatus?.expired}
                onChange={(e) => setExistingConsentAttested(e.target.checked)}
              />
              <span>
                I certify that I have the required permission to send SMS messages to callers covered
                by this test.
              </span>
            </label>
          ) : null}
        </div>

        <MctbHeroNumber label="Demo number" number={demoDisplay} tint="blue" />

        {!tryItStarted ? (
          <div className="space-y-3">
            <h2 className={SECTION_TITLE}>2. Start demo test</h2>
            <Button
              className="shadow-sm"
              disabled={
                startingTryIt || (consentMode === "existing_consent" && !existingConsentAttested)
              }
              onClick={() => void startTryIt()}
            >
              <Phone className="mr-2 h-4 w-4" aria-hidden />
              Start demo test
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className={SECTION_TITLE}>Demo progress</h2>
            <p className="text-[13px] font-medium text-foreground">
              {tryItStatus?.completed
                ? "Demo complete — check your phone for the recovery text."
                : tryItStatus?.waitingForCall
                  ? "Waiting for your call…"
                  : "Call in progress…"}
            </p>
            <MctbCheckpointList
              items={[
                { done: tryItStatus?.checks.callReceived || false, label: "Call received" },
                { done: tryItStatus?.checks.greetingPlayed || false, label: "Greeting played" },
                ...(showPress1
                  ? [{ done: tryItStatus?.checks.press1Received || false, label: "Press 1 received" }]
                  : []),
                { done: tryItStatus?.checks.consentConfirmed || false, label: "Consent confirmed" },
                {
                  done: tryItStatus?.checks.recoverySmsQueued || false,
                  label: "Recovery SMS queued",
                },
                { done: tryItStatus?.checks.recoverySmsSent || false, label: "Recovery SMS sent" },
              ]}
            />
            {tryItStatus?.expired ? (
              <Button variant="secondary" onClick={() => void startTryIt()} disabled={startingTryIt}>
                Start a new demo test
              </Button>
            ) : null}
          </div>
        )}
      </div>

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
          <MctbCheckpointList
            items={[
              { done: setupTest.checks.transovoDidReceived, label: "Call reached MCTB number" },
              { done: setupTest.checks.workspaceResolved, label: "Workspace resolved" },
              { done: setupTest.checks.consentModeLoaded, label: "Consent mode loaded" },
              { done: setupTest.checks.greetingPlayed, label: "Greeting played" },
              ...(setupTest.consentMode === "press_1"
                ? [{ done: setupTest.checks.press1Received, label: "Press 1 received" }]
                : []),
              { done: setupTest.checks.consentRecorded, label: "Consent recorded" },
              { done: setupTest.checks.missedCallEventCreated, label: "Missed call event created" },
              { done: setupTest.checks.smsQueued, label: "Recovery SMS queued" },
              { done: setupTest.checks.smsProviderAccepted, label: "SMS accepted by provider" },
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
          <MctbCheckpointList
            items={[
              { done: liveTest.checks.callDetected, label: "Call arrived on MCTB number" },
              { done: liveTest.checks.missedCall, label: "Classified as missed call" },
              { done: liveTest.checks.consentCompleted, label: "Consent completed (if required)" },
              { done: liveTest.checks.textSent, label: "Recovery SMS sent" },
              { done: liveTest.checks.textDelivered, label: "SMS delivered" },
              { done: liveTest.checks.replyReceived, label: "Reply received in inbox" },
            ]}
          />
        ) : null}
      </div>

      <MctbCallout icon={Phone} title="After testing">
        Verify carrier forwarding in{" "}
        <Link href={MCTB_ROUTES.setupPhone} className="font-semibold text-primary hover:underline">
          Phone & Forwarding
        </Link>
        . Review consent and message copy before activating recovery.
      </MctbCallout>
    </MctbSetupSectionLayout>
  );
}
