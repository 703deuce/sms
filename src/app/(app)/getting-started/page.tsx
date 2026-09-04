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
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CircleHelp,
  CreditCard,
  FileText,
  KeyRound,
  MessageSquareText,
  PartyPopper,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

const STEP_ICONS: Record<number, typeof Building2> = {
  1: UserCheck,
  2: Building2,
  3: CreditCard,
  4: ShieldCheck,
  5: Phone,
  6: MessageSquareText,
  7: Users,
  8: FileText,
  9: Send,
  10: KeyRound,
};

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
  const totalSteps = gettingStartedSteps.length;
  const progress = Math.round((doneCount / totalSteps) * 100);
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
      <Card className="relative mb-4 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5 sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/[0.07] blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 left-1/3 h-40 w-40 rounded-full bg-primary/[0.04] blur-2xl"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 shadow-sm">
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
            <Button className="gap-1.5 shadow-sm">
              Build your team
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>

      {/* Progress */}
      <Card className="mb-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <CardTitle>Setup progress</CardTitle>
            <p className="mt-1 text-[13px] text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{doneCount}</span>
              {" "}of{" "}
              <span className="tabular-nums">{totalSteps}</span> steps complete
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3.5">
            {/* Progress ring */}
            <div className="relative h-12 w-12">
              <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  strokeWidth="4.5"
                  className="stroke-muted"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="18"
                  fill="none"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * (1 - progress / 100)}`}
                  className="stroke-primary transition-all duration-700 ease-out"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-[11px] font-semibold tabular-nums text-foreground">
                {progress}%
              </span>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Account
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                readiness
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-3.5">
          {nextStep ? (
            <p className="min-w-0 truncate text-[13px] text-muted-foreground">
              Next up:{" "}
              {nextStep.href ? (
                <Link
                  href={nextStep.href}
                  className="font-semibold text-primary transition-colors hover:text-primary-hover hover:underline"
                >
                  {nextStep.label}
                </Link>
              ) : (
                <span className="font-semibold text-foreground">{nextStep.label}</span>
              )}
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-success">
              <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-success/15">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              All steps complete — you&apos;re ready to send.
            </p>
          )}
          {nextStep?.href ? (
            <Link
              href={nextStep.href}
              className="inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary transition-colors hover:text-primary-hover"
            >
              Resume
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </Card>

      {/* All-done celebration strip */}
      {allDone ? (
        <Card className="mb-4 border-success/25 bg-success/[0.05] p-4 sm:px-5">
          <div className="flex items-center gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
              <PartyPopper className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-semibold text-foreground">
                Setup complete
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Your account is fully configured. Send your first campaign or explore the dashboard.
              </p>
            </div>
            <Link href="/send" className="shrink-0">
              <Button size="sm" className="gap-1.5">
                New campaign
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}

      {/* Checklist */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
          <CardTitle>Checklist</CardTitle>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground shadow-sm">
            <span className="text-foreground">{doneCount}</span>/{totalSteps} complete
          </span>
        </div>
        <ul className="divide-y divide-border/70">
          {gettingStartedSteps.map((step) => {
            const isNext = step.id === nextStep?.id;
            const StepIcon = STEP_ICONS[step.id] || Check;
            const row = (
              <li
                className={`group relative flex items-center gap-3.5 px-5 py-3 transition-colors duration-150 ${
                  step.href && !step.done ? "cursor-pointer hover:bg-muted/40" : ""
                } ${isNext ? "bg-primary/[0.045]" : ""}`}
              >
                {isNext ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[3px] bg-primary"
                  />
                ) : null}
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                    step.done
                      ? "bg-success/12 text-success"
                      : isNext
                        ? "bg-primary text-primary-foreground shadow-sm ring-4 ring-primary/10"
                        : "border border-border bg-muted/60 text-muted-foreground/60"
                  }`}
                >
                  {step.done ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5" />
                  )}
                </span>
                <p
                  className={`min-w-0 flex-1 truncate text-[13.5px] ${
                    step.done
                      ? "text-muted-foreground"
                      : isNext
                        ? "font-semibold text-foreground"
                        : "font-medium text-foreground/85"
                  }`}
                >
                  <span className="mr-1.5 hidden text-[11px] font-semibold tabular-nums text-muted-foreground/50 sm:inline">
                    {String(step.id).padStart(2, "0")}
                  </span>
                  {step.label}
                </p>
                {step.href && !step.done ? (
                  <span className="hidden shrink-0 items-center gap-1 text-[13px] font-medium text-primary transition-opacity group-hover:inline-flex">
                    Open
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </span>
                ) : null}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    step.done
                      ? "bg-success/10 text-success"
                      : isNext
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "bg-muted text-muted-foreground/70"
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
        <Card className="group p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-muted/80">
              <CircleHelp className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <CardTitle>Need help?</CardTitle>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Review A2P registration requirements, consent best practices, and first-send tips.
              </p>
              <Link
                href="/compliance"
                className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                Compliance center
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Card>
        <Card className="group p-5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10">
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
