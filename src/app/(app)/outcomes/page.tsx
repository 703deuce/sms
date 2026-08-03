import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadOutcomeInstances } from "@/lib/outcomes/instances";
import { outcomeHref, outcomeSolutions } from "@/lib/outcomes/registry";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

const recommended = [
  "answer-every-call",
  "missed-overflow",
  "appointment-booking",
  "missed-call-text-back",
  "instant-lead-response",
  "review-requests",
];

export default async function SolutionsDashboardPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const instancesBySolution = await loadOutcomeInstances(workspaceId);

  const active: Array<{ solutionTitle: string; label: string; status: string; href: string }> =
    [];
  const drafts: typeof active = [];

  for (const solution of outcomeSolutions) {
    for (const inst of instancesBySolution[solution.slug] ?? []) {
      const row = {
        solutionTitle: solution.title,
        label: inst.label,
        status: inst.status,
        href: inst.href,
      };
      if (inst.status === "Draft") drafts.push(row);
      else active.push(row);
    }
  }

  // Deduplicate agents that matched multiple solution buckets.
  const seen = new Set<string>();
  const dedupe = <T extends { href: string; label: string }>(rows: T[]) =>
    rows.filter((r) => {
      const key = `${r.href}:${r.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const activeUnique = dedupe(active);
  const draftUnique = dedupe(drafts);

  const quickSetups = outcomeSolutions.filter((s) =>
    [
      "answer-every-call",
      "missed-overflow",
      "after-hours",
      "appointment-booking",
      "missed-call-text-back",
    ].includes(s.slug),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="What do you want Transovo to do?"
        description="Choose a business outcome. Each solution stays available after setup — overview, quick settings, and results — so you never have to re-enter the full wizard for a small change."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Active solutions", value: activeUnique.length, href: "/outcomes" },
          { label: "Draft solutions", value: draftUnique.length, href: "/outcomes" },
          {
            label: "Needs attention",
            value: draftUnique.length,
            href: draftUnique[0]?.href ?? "/compliance",
          },
          {
            label: "Recommended next",
            value: recommended.length,
            href: outcomeHref(recommended[0]),
          },
        ].map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30"
          >
            <p className="text-[12px] font-semibold text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-[28px] font-bold tracking-tight text-foreground">
              {card.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Active & draft setups</CardTitle>
          {activeUnique.length + draftUnique.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No solutions configured yet. Start with a quick setup below.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {[...activeUnique, ...draftUnique].slice(0, 8).map((row) => (
                <li
                  key={`${row.href}-${row.label}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="text-[12px] text-muted-foreground">
                      {row.solutionTitle} · {row.status}
                    </p>
                  </div>
                  <Link href={row.href}>
                    <Button variant="outline" size="sm">
                      Open
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <CardTitle>Quick setup</CardTitle>
          </div>
          <ul className="mt-3 space-y-2">
            {quickSetups.map((solution) => (
              <li key={solution.slug}>
                <Link
                  href={solution.setupHref || outcomeHref(solution.slug)}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm font-medium transition hover:border-primary/40 hover:bg-muted/40"
                >
                  {solution.title}
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Recommended next solutions</CardTitle>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recommended.map((slug) => {
            const solution = outcomeSolutions.find((s) => s.slug === slug);
            if (!solution) return null;
            const has = (instancesBySolution[slug] ?? []).length > 0;
            return (
              <Link
                key={slug}
                href={outcomeHref(slug)}
                className="rounded-xl border border-border p-4 transition hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{solution.title}</p>
                  {has ? (
                    <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                      Active
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground">{solution.summary}</p>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
