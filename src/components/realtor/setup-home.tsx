import { Card } from "@/components/ui/card";
import type { SetupHomeStep, SetupStepStatus } from "@/lib/realtor/setup-home";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, Sparkles } from "lucide-react";
import Link from "next/link";

function StatusIcon({ status }: { status: SetupStepStatus }) {
  if (status === "complete") {
    return <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden />;
  }
  if (status === "pending") {
    return <Clock className="h-5 w-5 text-amber-500" aria-hidden />;
  }
  if (status === "ready") {
    return <Sparkles className="h-5 w-5 text-primary/70" aria-hidden />;
  }
  return <Circle className="h-5 w-5 text-muted-foreground/50" aria-hidden />;
}

function SetupRow({ step }: { step: SetupHomeStep }) {
  return (
    <Card className="flex items-center gap-4 p-4 transition hover:border-primary/30">
      <StatusIcon status={step.status} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-foreground">{step.title}</h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              step.status === "complete" && "bg-primary/10 text-primary",
              step.status === "ready" && "bg-primary/5 text-primary",
              step.status === "pending" && "bg-amber-500/10 text-amber-700",
              step.status === "not_started" && "bg-muted text-muted-foreground",
            )}
          >
            {step.statusLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
      </div>
      <Link
        href={step.href}
        className={cn(
          "inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium",
          step.status === "complete"
            ? "border border-border bg-card hover:bg-muted"
            : "bg-primary text-primary-foreground hover:bg-primary-hover",
        )}
      >
        {step.actionLabel}
      </Link>
    </Card>
  );
}

export function SetupHomeView({
  requiredComplete,
  requiredTotal,
  steps,
  readyToGoLive,
  live,
}: {
  requiredComplete: number;
  requiredTotal: number;
  steps: SetupHomeStep[];
  readyToGoLive: boolean;
  live: boolean;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Get Amy Ready</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {live
            ? "Your workspace is live. Return here anytime to finish optional setup or adjust agents."
            : "Complete the essentials below. You can work through them in any sensible order."}
        </p>
        <p className="mt-3 text-sm font-medium text-foreground">
          {requiredComplete} of {requiredTotal} required steps complete
        </p>
        <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${requiredTotal ? (requiredComplete / requiredTotal) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <SetupRow key={step.id} step={step} />
        ))}
      </div>

      {readyToGoLive ? (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <p className="font-medium">You&apos;re ready to activate Amy.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Run a test call, then publish from Front Desk or Speed-to-Lead, or finish the guided
            review in onboarding.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/realtor/test" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              Test Amy
            </Link>
            <Link
              href="/realtor/onboarding?step=review"
              className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium"
            >
              Review &amp; activate
            </Link>
          </div>
        </Card>
      ) : null}

      {live ? (
        <div className="flex gap-2">
          <Link
            href="/realtor/dashboard"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Go to Dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}
