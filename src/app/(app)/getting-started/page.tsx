import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { gettingStartedSteps } from "@/lib/mock/data";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function GettingStartedPage() {
  const doneCount = gettingStartedSteps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / gettingStartedSteps.length) * 100);
  const nextStep = gettingStartedSteps.find((s) => !s.done);

  return (
    <div>
      <PageHeader
        title="Getting started"
        description="Complete these steps to verify your account, register for A2P, and send your first campaign."
        actions={
          <>
            <Link href="/dashboard">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
            {nextStep?.href ? (
              <Link href={nextStep.href}>
                <Button>Continue setup</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Setup progress</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {doneCount} of {gettingStartedSteps.length} steps complete
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-3xl font-semibold text-primary">{progress}%</p>
            <p className="text-xs text-muted-foreground">Account readiness</p>
          </div>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        {nextStep ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Next up: <span className="font-medium text-foreground">{nextStep.label}</span>
          </p>
        ) : (
          <p className="mt-3 text-sm font-medium text-success">All steps complete — you&apos;re ready to send.</p>
        )}
      </Card>

      <Card>
        <CardTitle>Checklist</CardTitle>
        <ul className="mt-4 divide-y divide-border">
          {gettingStartedSteps.map((step, index) => (
            <li key={step.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <p className={`font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>
                    {step.label}
                  </p>
                </div>
                {step.href && !step.done ? (
                  <Link
                    href={step.href}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Open step
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  step.done ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                }`}
              >
                {step.done ? "Done" : "To do"}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Need help?</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Review A2P registration requirements, consent best practices, and first-send tips in our setup guide.
          </p>
          <Link href="/compliance" className="mt-4 inline-flex">
            <Button variant="outline" size="sm">
              Compliance center
            </Button>
          </Link>
        </Card>
        <Card>
          <CardTitle>Ready to send?</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the campaign wizard for full audience targeting, or send a quick one-off text to selected contacts.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/send">
              <Button size="sm">New campaign</Button>
            </Link>
            <Link href="/send/quick">
              <Button variant="outline" size="sm">
                Quick text
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
