import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  deriveGettingStartedSteps,
} from "@/lib/compliance-helpers";
import {
  requireWorkspaceContext,
  loadComplianceOverview,
  loadDashboardMetrics,
  loadPhoneNumbers,
  loadContacts,
  loadTemplates,
  loadCampaigns,
} from "@/lib/workspace-data";
import { ArrowRight, Check, CircleHelp, Send, Sparkles } from "lucide-react";
import Link from "next/link";

export default async function GettingStartedPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const [overview, metrics, phoneNumbers, contacts, templates, campaigns] = await Promise.all([
    loadComplianceOverview(workspaceId),
    loadDashboardMetrics(workspaceId),
    loadPhoneNumbers(workspaceId),
    loadContacts(workspaceId),
    loadTemplates(workspaceId),
    loadCampaigns(workspaceId),
  ]);

  const gettingStartedSteps = deriveGettingStartedSteps({
    hasBusiness: Boolean(overview.registration?.legalBusinessName),
    hasPayment: metrics.balance > 0,
    a2pReady: overview.ready,
    hasNumber: phoneNumbers.length > 0 || Boolean(overview.registration?.phoneE164),
    contactCount: contacts.length,
    templateCount: templates.length,
    hasSentCampaign: campaigns.some((c) => c.sent > 0),
  });

  const doneCount = gettingStartedSteps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / gettingStartedSteps.length) * 100);
  const nextStep = gettingStartedSteps.find((s) => !s.done);
  const allDone = !nextStep;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Getting started"
        description="Hire your communications team, then finish messaging readiness when you need SMS campaigns."
        actions={
          <>
            <Link href="/dashboard">
              <Button variant="outline" size="sm">Dashboard</Button>
            </Link>
            {nextStep?.href ? (
              <Link href={nextStep.href}>
                <Button size="sm" className="gap-1.5">
                  Continue checklist
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      {/* Hero: hire the team */}
      <Card className="mb-4 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-foreground">
                Hire Amy or Tom
              </h2>
              <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                Start with your communications team — not a blank dashboard.
                Amy books appointments. Tom recovers missed calls.
              </p>
            </div>
          </div>
          <Link href="/hire" className="shrink-0">
            <Button className="gap-1.5">
              Build your team
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>

      {/* Progress */}
      <Card className="mb-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Setup progress</CardTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {doneCount} of {gettingStartedSteps.length} steps complete
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-[28px] font-semibold leading-none tracking-tight text-primary">
              {progress}%
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Account readiness
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {nextStep ? (
          <p className="mt-3.5 text-[13px] text-muted-foreground">
            Next up:{" "}
            {nextStep.href ? (
              <Link href={nextStep.href} className="font-medium text-primary hover:underline">
                {nextStep.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{nextStep.label}</span>
            )}
          </p>
        ) : (
          <p className="mt-3.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
            <Check className="h-4 w-4" />
            All steps complete — you&apos;re ready to send.
          </p>
        )}
      </Card>

      {/* Checklist */}
      <Card className="p-0">
        <div className="border-b border-border px-5 py-4">
          <CardTitle>Checklist</CardTitle>
        </div>
        <ul className="divide-y divide-border">
          {gettingStartedSteps.map((step, index) => {
            const isNext = step.id === nextStep?.id;
            const row = (
              <li
                className={`group flex items-center gap-3.5 px-5 py-3 transition-colors ${
                  step.href && !step.done ? "hover:bg-muted/40" : ""
                } ${isNext ? "bg-primary/[0.04]" : ""}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    step.done
                      ? "bg-success/10 text-success"
                      : isNext
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <p
                  className={`min-w-0 flex-1 truncate text-sm ${
                    step.done
                      ? "text-muted-foreground line-through decoration-muted-foreground/40"
                      : "font-medium text-foreground"
                  }`}
                >
                  {step.label}
                </p>
                {step.href && !step.done ? (
                  <span className="hidden shrink-0 items-center gap-1 text-[13px] font-medium text-primary group-hover:inline-flex">
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                ) : null}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    step.done
                      ? "bg-success/10 text-success"
                      : isNext
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step.done ? "Done" : isNext ? "Up next" : "To do"}
                </span>
              </li>
            );

            if (step.href && !step.done) {
              return (
                <Link key={step.id} href={step.href} className="block">
                  {row}
                </Link>
              );
            }
            return <div key={step.id}>{row}</div>;
          })}
        </ul>
      </Card>

      {/* Footer helpers */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <CircleHelp className="h-4.5 w-4.5 h-5 w-5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Need help?</CardTitle>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Review A2P registration requirements, consent best practices, and first-send tips.
              </p>
              <Link href="/compliance" className="mt-3 inline-flex">
                <Button variant="outline" size="sm">
                  Compliance center
                </Button>
              </Link>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Send className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <CardTitle>{allDone ? "You're ready to send" : "Ready to send?"}</CardTitle>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Use the campaign wizard for full audience targeting, or send a quick one-off text.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/send">
                  <Button size="sm">New campaign</Button>
                </Link>
                <Link href="/send/quick">
                  <Button variant="outline" size="sm">
                    Quick text
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
