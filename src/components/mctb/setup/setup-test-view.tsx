"use client";

import { Button } from "@/components/ui/button";
import { MctbSetupSectionLayout } from "@/components/mctb/setup/mctb-setup-section-layout";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { TryItStatus } from "@/lib/mctb/try-it/types";
import { cn } from "@/lib/utils";
import { Phone, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function StepCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
          done ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
        )}
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
  const [status, setStatus] = useState<TryItStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/mctb/try-it");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || "Failed to load test status");
      return;
    }
    setStatus(json.data);
    if (json.data?.consentMode) setConsentMode(json.data.consentMode);
    setError(null);
  }, []);

  useEffect(() => {
    void refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!status?.sessionActive) return;
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [status?.sessionActive, refresh]);

  async function startTest() {
    setStarting(true);
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
      if (!res.ok) throw new Error(json?.error || "Could not start test");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start test");
    } finally {
      setStarting(false);
    }
  }

  const demoDisplay = status?.demoNumberDisplay || "—";
  const showPress1 = consentMode === "press_1";
  const started = Boolean(status?.sessionActive || status?.completed);

  if (loading) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner">
          <div className="ref-card p-12 text-center text-sm text-gray-500">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <MctbSetupSectionLayout
      title="Test & diagnostics"
      description="Run an end-to-end missed-call recovery test on the same Telnyx path as production before forwarding your business line."
      showSave={false}
      error={error}
    >
      <div className="ref-card flex items-start gap-3 border-indigo-100 bg-indigo-50/40 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" aria-hidden />
        <div className="text-[13px] text-indigo-950">
          <p className="font-semibold">Demo test number</p>
          <p className="mt-1 text-indigo-900/90">
            Call your workspace MCTB demo line directly from your verified mobile — no carrier
            forwarding required. Use this to validate Press 1 or existing permission before going live.
          </p>
        </div>
      </div>

      <div className="ref-card space-y-5 p-5">
        <div>
          <h2 className="mctb-section-title">1. Choose consent mode for this test</h2>
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
                disabled={started && !status?.expired}
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
                disabled={started && !status?.expired}
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
            Your demo number
          </p>
          <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-primary">
            {demoDisplay}
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Call this number from your verified mobile and let the test run.
            {status?.callerE164 ? (
              <>
                {" "}
                Verified caller:{" "}
                <span className="font-semibold text-foreground">{status.callerE164}</span>
              </>
            ) : null}
          </p>
        </div>

        {!started ? (
          <div className="space-y-3">
            <h2 className="mctb-section-title">2. Start the test</h2>
            <p className="text-[13px] text-muted-foreground">
              Progress updates live while your call is in progress.
            </p>
            <Button
              disabled={
                starting || (consentMode === "existing_consent" && !existingConsentAttested)
              }
              onClick={() => void startTest()}
            >
              <Phone className="mr-2 h-4 w-4" aria-hidden />
              Start test
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="mctb-section-title">Test progress</h2>
            <p className="text-[13px] font-medium text-foreground">
              {status?.completed
                ? "Test complete — check your phone for the recovery text."
                : status?.waitingForCall
                  ? "Waiting for your call…"
                  : "Call in progress…"}
            </p>
            <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
              <StepCheck done={status?.checks.callReceived || false} label="Call received" />
              <StepCheck done={status?.checks.greetingPlayed || false} label="Greeting played" />
              {showPress1 ? (
                <StepCheck done={status?.checks.press1Received || false} label="Press 1 received" />
              ) : null}
              <StepCheck done={status?.checks.consentConfirmed || false} label="Consent confirmed" />
              <StepCheck
                done={status?.checks.recoverySmsQueued || false}
                label="Recovery SMS queued"
              />
              <StepCheck done={status?.checks.recoverySmsSent || false} label="Recovery SMS sent" />
            </div>
            {status?.expired ? (
              <Button variant="secondary" onClick={() => void startTest()} disabled={starting}>
                Start a new test
              </Button>
            ) : null}
          </div>
        )}
      </div>

      <div className="ref-card space-y-2 p-5 text-[13px] text-muted-foreground">
        <p className="font-semibold text-foreground">After testing</p>
        <p>
          Verify carrier forwarding on your business line in{" "}
          <Link href={MCTB_ROUTES.setupPhone} className="font-semibold text-primary hover:underline">
            Phone & Forwarding
          </Link>
          . Review consent and message copy before activating recovery.
        </p>
      </div>
    </MctbSetupSectionLayout>
  );
}
