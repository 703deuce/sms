import { GitBranch, ExternalLink } from "lucide-react";
import { Card, CardTitle, cn, formatNumber } from "./ui";
import type { RoutingFormSummary } from "../mock-data";

export function RoutingFormsPanel({ forms }: { forms: RoutingFormSummary[] }) {
  const totalViews = forms.reduce((sum, f) => sum + f.views, 0);
  const totalRouted = forms.reduce((sum, f) => sum + f.routed, 0);
  const conversion =
    totalViews > 0 ? Math.round((totalRouted / totalViews) * 100) : null;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Routing forms</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Lead qualification and routing performance in this range
          </p>
        </div>
        <a
          href="/appointments/routing-forms"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Manage forms
          <ExternalLink size={12} />
        </a>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        {[
          { label: "Form views", value: formatNumber(totalViews) },
          { label: "Routed", value: formatNumber(totalRouted) },
          {
            label: "Conversion",
            value: conversion !== null ? `${conversion}%` : "—",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-border bg-muted/30 px-3 py-2.5"
          >
            <dt className="text-[11px] font-medium text-muted-foreground">
              {stat.label}
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {forms.length === 0 ? (
        <p className="mt-4 text-[13px] text-muted-foreground">
          No routing forms yet. Create one to qualify leads before they book.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {forms.map((form, i) => {
            const rate =
              form.views > 0
                ? Math.round((form.routed / form.views) * 100)
                : null;
            const max = Math.max(1, ...forms.map((f) => f.routed));
            return (
              <li key={form.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-foreground">
                    <GitBranch size={13} className="shrink-0 text-primary" />
                    {form.name}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                    {formatNumber(form.routed)} routed
                    {rate !== null ? ` · ${rate}%` : ""}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      i === 0 ? "bg-primary" : "bg-indigo-300",
                    )}
                    style={{ width: `${(form.routed / max) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatNumber(form.views)} views
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
