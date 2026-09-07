"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarPlus,
  Check,
  CircleAlert,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { gettingStartedData, type GettingStartedData } from "../types";
import { ProgressRing } from "./ProgressRing";
import { StepRow } from "./StepRow";
import { ResourceCards } from "./ResourceCards";

type SimState = "normal" | "loading" | "first-use" | "error" | "read-only";

function simulate(data: GettingStartedData, state: SimState) {
  if (state === "first-use") {
    return {
      ...data,
      messagingStatus: "NOT_STARTED" as const,
      steps: data.steps.map((s, i) => ({ ...s, done: i === 0 })),
    };
  }
  return data;
}

export function GettingStartedPage({ data: dataProp }: { data?: GettingStartedData }) {
  const [simState, setSimState] = useState<SimState>("normal");
  const data = useMemo(
    () => (dataProp ? dataProp : simulate(gettingStartedData, simState)),
    [dataProp, simState],
  );

  const doneCount = data.steps.filter((s) => s.done).length;
  const totalSteps = data.steps.length;
  const progress = Math.round((doneCount / totalSteps) * 100);
  const nextStep = data.steps.find((s) => !s.done);
  const allDone = !nextStep;
  const readOnly = simState === "read-only";

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* State simulator (sandbox only) */}
        {!dataProp && (
        <div className="mb-5 flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-border bg-card px-3 py-2">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Simulate state
          </span>
          {(["normal", "loading", "first-use", "error", "read-only"] as SimState[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSimState(s)}
              className={`h-7 rounded-md px-2.5 text-[12px] font-semibold transition-colors ${
                simState === s
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s === "first-use" ? "First use" : s === "read-only" ? "Read-only" : s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        )}

        {/* Page header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Getting started
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Set up booking, reminders, and texting so customers can schedule with{" "}
              <span className="font-medium text-foreground">{data.workspaceName}</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/appointments/overview"
              className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-3 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted"
            >
              Go to Home
            </a>
            {nextStep?.href && !readOnly ? (
              <a
                href={nextStep.href}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
              >
                Continue checklist
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        {/* Read-only notice */}
        {readOnly ? (
          <div
            role="status"
            className="mb-4 flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground">View-only access.</span> Your role
              can view setup progress, but only an owner or admin can change workspace settings.
            </p>
          </div>
        ) : null}

        {/* Error state */}
        {simState === "error" ? (
          <div className="surface rounded-xl p-8 text-center">
            <TriangleAlert className="mx-auto h-8 w-8 text-warning" />
            <h2 className="mt-3 font-display text-[15px] font-semibold text-foreground">
              Setup progress couldn’t be loaded
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
              Your checklist is saved — we just couldn’t fetch the latest status. Nothing was lost.
            </p>
            <button
              type="button"
              onClick={() => setSimState("normal")}
              className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
            >
              Retry
            </button>
          </div>
        ) : simState === "loading" ? (
          /* Loading state — skeleton preserves structure */
          <div className="space-y-4" aria-busy="true" aria-label="Loading setup progress">
            <div className="surface h-[104px] animate-pulse rounded-xl bg-muted/60" />
            <div className="surface h-[88px] animate-pulse rounded-xl bg-muted/60" />
            <div className="surface rounded-xl p-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3.5 px-3 py-3">
                  <div className="h-[26px] w-[26px] animate-pulse rounded-full bg-muted" />
                  <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-64 max-w-full animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Hero: primary job */}
            <div className="surface relative mb-4 overflow-hidden rounded-xl p-5 sm:p-6">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full"
                style={{ background: "rgba(79,70,229,0.07)", filter: "blur(48px)" }}
              />
              <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 shadow-sm">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                      {allDone ? "You’re all set" : "Start taking bookings"}
                    </h2>
                    <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                      {allDone
                        ? "Your booking page, reminders, and texting are ready. Customers can book with you now."
                        : "Finish the checklist below and your customers can book appointments online — with confirmations and SMS reminders sent automatically."}
                    </p>
                  </div>
                </div>
                {!allDone && !readOnly ? (
                  <a
                    href="/appointments/types"
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Create booking type
                  </a>
                ) : null}
              </div>
            </div>

            {/* Messaging readiness notice (partial/degraded) */}
            {data.messagingStatus !== "READY" && !allDone ? (
              <div
                role="status"
                className="mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3"
                style={{
                  background: "var(--warning-bg)",
                  borderColor: "var(--warning-border)",
                }}
              >
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--warning)" }} />
                <p className="text-[13px] leading-relaxed" style={{ color: "#92400e" }}>
                  <span className="font-semibold">SMS reminders are paused.</span> Carrier
                  registration is {data.messagingStatus === "PENDING" ? "under review" : "not started"}.
                  Booking works now — reminders turn on automatically once approved.{" "}
                  {!readOnly ? (
                    <a href="/settings/messaging" className="font-semibold underline underline-offset-2">
                      View registration status
                    </a>
                  ) : null}
                </p>
              </div>
            ) : null}

            {/* Progress */}
            <div className="surface mb-4 rounded-xl p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                    Setup progress
                  </h3>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    <span className="font-semibold tabular-nums text-foreground">{doneCount}</span> of{" "}
                    <span className="tabular-nums">{totalSteps}</span> steps complete
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3.5">
                  <ProgressRing progress={progress} />
                  <div className="hidden sm:block">
                    {allDone ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold"
                        style={{ background: "var(--success-bg)", borderColor: "var(--success-border)", color: "var(--success)" }}
                      >
                        <PartyPopper className="h-3.5 w-3.5" />
                        Complete
                      </span>
                    ) : (
                      <p className="max-w-[150px] text-[12px] leading-snug text-muted-foreground">
                        Next:{" "}
                        <span className="font-semibold text-foreground">{nextStep?.label}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="surface mb-6 rounded-xl p-2" role="list" aria-label="Setup checklist">
              {data.steps.map((step) => (
                <div role="listitem" key={step.id}>
                  <StepRow step={step} isNext={nextStep?.id === step.id} />
                </div>
              ))}
            </div>

            {/* All-done success state */}
            {allDone ? (
              <div
                className="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3.5"
                style={{ background: "var(--success-bg)", borderColor: "var(--success-border)" }}
                role="status"
              >
                <span className="gs-check gs-check--done">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <p className="text-[13px]" style={{ color: "var(--success)" }}>
                  <span className="font-semibold">Setup complete.</span> Share your booking page
                  link anywhere customers find you.{" "}
                  <a href="/appointments/booking" className="font-semibold underline underline-offset-2">
                    Copy booking link
                  </a>
                </p>
              </div>
            ) : null}

            {/* Resources */}
            <h3 className="mb-3 font-display text-sm font-semibold tracking-tight text-foreground">
              Guides &amp; support
            </h3>
            <ResourceCards />
          </>
        )}
      </div>
    </div>
  );
}
