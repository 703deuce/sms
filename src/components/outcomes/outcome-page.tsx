import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { SolutionNavInstance } from "@/lib/solutions-nav";
import {
  outcomeHref,
  type OutcomePageDef,
  type OutcomeSolutionDef,
} from "@/lib/outcomes/registry";
import { ArrowRight, CheckCircle2, Clock3, PlugZap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

function WorkflowDiagram() {
  const steps = [
    "Incoming call",
    "Ring team",
    "No answer or busy",
    "AI receptionist answers",
    "Help, book, transfer, or take message",
  ];
  return (
    <ol className="mt-4 space-y-2">
      {steps.map((step, i) => (
        <li key={step} className="flex items-start gap-3 text-sm text-foreground">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
            {i + 1}
          </span>
          <span>
            {step}
            {i < steps.length - 1 ? (
              <span className="mt-1 block text-[12px] text-muted-foreground">↓</span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function OutcomePageView({
  solution,
  page,
  instances = [],
}: {
  solution: OutcomeSolutionDef;
  page: OutcomePageDef;
  instances?: SolutionNavInstance[];
}) {
  // Setup pages with a launch href jump straight into the wizard / builder.
  if (page.kind === "setup" && page.launchHref) {
    redirect(page.launchHref);
  }

  if (page.kind === "overview" || page.slug === "") {
    return (
      <div className="space-y-5">
        <PageHeader
          title={solution.title}
          description={solution.summary}
          actions={
            solution.setupHref ? (
              <Link href={solution.setupHref}>
                <Button size="sm" className="gap-1.5">
                  {solution.slug === "ai-receptionist"
                    ? "Create receptionist"
                    : "Set Up"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : null
          }
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardTitle>What it does</CardTitle>
            <ul className="mt-3 space-y-2">
              {solution.whatItDoes.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>

            {solution.slug === "missed-overflow" ? (
              <div className="mt-6 border-t border-border pt-4">
                <CardTitle>How it works</CardTitle>
                <WorkflowDiagram />
              </div>
            ) : null}
          </Card>

          <div className="space-y-4">
            <Card>
              <CardTitle>Setup</CardTitle>
              <dl className="mt-3 space-y-3 text-sm">
                {solution.setupTime ? (
                  <div className="flex items-start gap-2">
                    <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <dt className="font-medium text-foreground">Typical time</dt>
                      <dd className="text-muted-foreground">{solution.setupTime}</dd>
                    </div>
                  </div>
                ) : null}
                {solution.requiredConnections?.length ? (
                  <div className="flex items-start gap-2">
                    <PlugZap className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div>
                      <dt className="font-medium text-foreground">Required connections</dt>
                      <dd className="text-muted-foreground">
                        {solution.requiredConnections.join(" · ")}
                      </dd>
                    </div>
                  </div>
                ) : null}
              </dl>
              {solution.setupHref ? (
                <div className="mt-4">
                  <Link href={solution.setupHref}>
                    <Button className="w-full gap-1.5">
                      Set Up
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              ) : null}
            </Card>

            <Card>
              <CardTitle>Shortcuts</CardTitle>
              <ul className="mt-3 divide-y divide-border">
                {solution.pages
                  .filter((p) => p.slug && p.kind !== "overview")
                  .map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={outcomeHref(solution.slug, p.slug)}
                        className="flex items-center justify-between gap-2 py-2.5 text-sm font-medium text-foreground hover:text-primary"
                      >
                        {p.label}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
              </ul>
            </Card>
          </div>
        </div>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>
              {solution.slug === "ai-receptionist"
                ? "Your receptionists"
                : "Existing setups"}
            </CardTitle>
            <Link href={outcomeHref(solution.slug, "active")}>
              <Button variant="outline" size="sm">
                Manage all
              </Button>
            </Link>
          </div>
          {instances.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing configured yet. Set up this solution to see it here for quick edits later —
              without reopening the full wizard.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {instances.map((inst) => (
                <li
                  key={inst.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{inst.label}</p>
                    <p className="text-[12px] text-muted-foreground">{inst.status}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(inst.children ?? [{ label: "Open", href: inst.href }])
                      .slice(0, 4)
                      .map((child) => (
                        <Link key={child.href + child.label} href={child.href}>
                          <Button variant="outline" size="sm">
                            {child.label}
                          </Button>
                        </Link>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  if (page.kind === "active" || page.kind === "list") {
    return (
      <div className="space-y-5">
        <PageHeader
          title={`${solution.title} · ${page.label}`}
          description={
            page.description ||
            `Manage existing ${solution.title.toLowerCase()} setups without re-running the full wizard.`
          }
          actions={
            solution.setupHref ? (
              <Link href={solution.setupHref}>
                <Button size="sm" className="gap-1.5">
                  + Set Up Another
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : null
          }
        />
        <Card>
          {instances.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active setups yet.{" "}
              {solution.setupHref ? (
                <Link href={solution.setupHref} className="font-medium text-primary hover:underline">
                  Create your first one
                </Link>
              ) : null}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {instances.map((inst) => (
                <li key={inst.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{inst.label}</p>
                      <p className="text-[12px] text-muted-foreground">{inst.status}</p>
                    </div>
                    <Link href={inst.href}>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </Link>
                  </div>
                  {inst.children?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {inst.children.map((child) => (
                        <Link key={child.href + child.label} href={child.href}>
                          <Button variant="ghost" size="sm" className="h-8">
                            {child.label}
                          </Button>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    );
  }

  // Quick-settings / results / test shells
  return (
    <div className="space-y-5">
      <PageHeader
        title={`${solution.title} · ${page.label}`}
        description={
          page.description ||
          `Quick settings for ${page.label.toLowerCase()}. Change one thing without reopening the full setup wizard.`
        }
        actions={
          <>
            <Link href={outcomeHref(solution.slug)}>
              <Button variant="outline" size="sm">
                Overview
              </Button>
            </Link>
            {page.launchHref ? (
              <Link href={page.launchHref}>
                <Button size="sm" className="gap-1.5">
                  Open tools
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <Card>
        <CardTitle>
          {page.kind === "results"
            ? "Results"
            : page.kind === "test"
              ? "Test"
              : "Quick settings"}
        </CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          {page.kind === "results"
            ? "Track calls rescued, conversations, bookings, messages, and recovery texts for this solution. Detailed charts live in Reports and Voice Analytics."
            : page.kind === "test"
              ? "Launch the Testing Lab to rehearse booking and call-handling scenarios before going live."
              : "These shortcuts open the underlying platform controls for this solution. Use them for small edits; use Set Up only for major reconfiguration or a new location."}
        </p>

        {page.launchHref ? (
          <div className="mt-4">
            <Link href={page.launchHref}>
              <Button className="gap-1.5">
                Continue to {page.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            Settings UI for this shortcut is coming next. For now, manage related configuration from
            Advanced → Voice Agents, Automations, or the platform tools linked in the sidebar.
          </div>
        )}

        {instances.length > 0 ? (
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
              Apply to setup
            </p>
            <ul className="mt-2 space-y-2">
              {instances.map((inst) => (
                <li key={inst.id}>
                  <Link
                    href={inst.href}
                    className="text-sm font-medium text-foreground hover:text-primary"
                  >
                    {inst.label} · {inst.status}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
