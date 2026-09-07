"use client";

import { Button } from "@/components/ui/button";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { TryItStatus } from "@/lib/mctb/try-it/types";
import type { MctbSetupTestStatus } from "@/lib/mctb/setup-test";
import type { LiveTestStatus } from "@/lib/mctb/onboarding/live-test";
import { cn } from "@/lib/utils";
import { Phone, Radio, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const SECTION_TITLE = "text-[15px] font-semibold tracking-tight text-foreground";

function StepCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
          done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {done ? "✓" : "·"}
      </span>
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

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
      {/* Demo try-it */}
      <div className="ref-card flex items-start gap-3 border-indigo-100 bg-indigo-50/40 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
        <div className="text-[13px] text-indigo-950">
          <p className="font-semibold">Demo test (no forwarding)</p>
          <p className="mt-1 text-indigo-900/90">
            Call your workspace demo line from your verified mobile. Use this before carrier forwarding
            is configured.
          </p>
        </div>
      </div>

      <div className="ref-card space-y-5 p-5">
        <div>
          <h2 className={SECTION_TITLE}>1. Choose consent mode for demo test</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: "press_1" as const,
                  title: "Ask callers to press 1",
                  body: "Hear the disclosure, press 1, receive compliance confirmation, then recovery text.",
                },
                {
                  id: "existing_consent" as const,
                  title: "Use permission my business already has",
                  body: "No Press-1 interaction. Recovery text sends after the missed-call path completes.",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={tryItStarted && !tryItStatus?.expired}
                onClick={() => setConsentMode(opt.id)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left text-sm transition",
                  consentMode === opt.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                    : "border-gray-200 hover:border-gray-300",
                )}
              >
                <p className="font-semibold text-foreground">{opt.title}</p>
                <p className="mt-1 text-[12px] text-muted-foreground">{opt.body}</p>
              </button>
            ))}
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

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Demo number
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-primary">
            {demoDisplay}
          </p>
        </div>

        {!tryItStarted ? (
          <div className="space-y-3">
            <h2 className={SECTION_TITLE}>2. Start demo test</h2>
            <Button
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
            <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
              <StepCheck done={tryItStatus?.checks.callReceived || false} label="Call received" />
              <StepCheck done={tryItStatus?.checks.greetingPlayed || false} label="Greeting played" />
              {showPress1 ? (
                <StepCheck done={tryItStatus?.checks.press1Received || false} label="Press 1 received" />
              ) : null}
              <StepCheck done={tryItStatus?.checks.consentConfirmed || false} label="Consent confirmed" />
              <StepCheck
                done={tryItStatus?.checks.recoverySmsQueued || false}
                label="Recovery SMS queued"
              />
              <StepCheck done={tryItStatus?.checks.recoverySmsSent || false} label="Recovery SMS sent" />
            </div>
            {tryItStatus?.expired ? (
              <Button variant="secondary" onClick={() => void startTryIt()} disabled={startingTryIt}>
                Start a new demo test
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {/* Production setup test */}
      <div className="ref-card flex items-start gap-3 border-emerald-100 bg-emerald-50/40 p-4">
        <Zap className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        <div className="text-[13px] text-emerald-950">
          <p className="font-semibold">Production path test</p>
          <p className="mt-1 text-emerald-900/90">
            Call your assigned MCTB number ({setupNumber}) directly. Validates workspace routing,
            consent mode, missed-call event creation, and SMS delivery on the production ingress.
          </p>
        </div>
      </div>

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
          <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <StepCheck done={setupTest.checks.transovoDidReceived} label="Call reached MCTB number" />
            <StepCheck done={setupTest.checks.workspaceResolved} label="Workspace resolved" />
            <StepCheck done={setupTest.checks.consentModeLoaded} label="Consent mode loaded" />
            <StepCheck done={setupTest.checks.greetingPlayed} label="Greeting played" />
            {setupTest.consentMode === "press_1" ? (
              <StepCheck done={setupTest.checks.press1Received} label="Press 1 received" />
            ) : null}
            <StepCheck done={setupTest.checks.consentRecorded} label="Consent recorded" />
            <StepCheck done={setupTest.checks.missedCallEventCreated} label="Missed call event created" />
            <StepCheck done={setupTest.checks.smsQueued} label="Recovery SMS queued" />
            <StepCheck done={setupTest.checks.smsProviderAccepted} label="SMS accepted by provider" />
          </div>
        ) : null}
        {setupTest?.failureReason ? (
          <p className="text-[13px] text-amber-800">{setupTest.failureReason}</p>
        ) : null}
      </div>

      {/* Live forward test */}
      <div className="ref-card flex items-start gap-3 border-sky-100 bg-sky-50/40 p-4">
        <Radio className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
        <div className="text-[13px] text-sky-950">
          <p className="font-semibold">Forwarded business line test</p>
          <p className="mt-1 text-sky-900/90">
            Call {liveBusiness} from another phone and don&apos;t answer. Transovo should receive the
            forward on {liveForward}, classify the miss, and send recovery SMS.
          </p>
        </div>
      </div>

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
          <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
            <StepCheck done={liveTest.checks.callDetected} label="Call arrived on MCTB number" />
            <StepCheck done={liveTest.checks.missedCall} label="Classified as missed call" />
            <StepCheck done={liveTest.checks.consentCompleted} label="Consent completed (if required)" />
            <StepCheck done={liveTest.checks.textSent} label="Recovery SMS sent" />
            <StepCheck done={liveTest.checks.textDelivered} label="SMS delivered" />
            <StepCheck done={liveTest.checks.replyReceived} label="Reply received in inbox" />
          </div>
        ) : null}
      </div>

      <div className="ref-card space-y-2 p-5 text-[13px] text-muted-foreground">
        <p className="font-semibold text-foreground">After testing</p>
        <p>
          Verify carrier forwarding in{" "}
          <Link href={MCTB_ROUTES.setupPhone} className="font-semibold text-primary hover:underline">
            Phone & Forwarding
          </Link>
          . Review consent and message copy before activating recovery.
        </p>
      </div>
    </MctbSetupSectionLayout>
  );
}
