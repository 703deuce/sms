"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Lock, AlertCircle } from "lucide-react";
import {
  Page,
  PageHeader,
  Panel,
  Pill,
  SetupProgressBar,
  TextLink,
} from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import type { MctbGettingStartedPayload } from "@/lib/mctb/getting-started/types";
import { saveMctbSetup } from "@/lib/newui-transplant/api/mctb-setup-client";

function toneForPill(tone: string): "success" | "warning" | "neutral" | "danger" {
  if (tone === "complete" || tone === "ready" || tone === "active") return "success";
  if (tone === "needs_setup" || tone === "not_tested" || tone === "pending" || tone === "testing")
    return "warning";
  if (tone === "failed" || tone === "needs_attention") return "danger";
  return "neutral";
}

function RowIcon({ tone, locked }: { tone: string; locked?: boolean }) {
  if (locked) return <Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  if (tone === "complete" || tone === "ready" || tone === "active")
    return <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />;
  if (tone === "needs_attention" || tone === "failed")
    return <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden />;
  return <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}

export function MctbGettingStartedPage() {
  const [data, setData] = useState<MctbGettingStartedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mctb/getting-started", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load getting started");
      setData(json.data as MctbGettingStartedPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <Page>
        <p className="text-sm text-muted-foreground">Loading setup status…</p>
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page>
        <p className="text-sm text-destructive" role="alert">{error ?? "Unavailable"}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => void load()}>
          Retry
        </Button>
      </Page>
    );
  }

  const headerDescription = data.operationalReady
    ? "Your missed-call recovery is ready. Review your setup or explore additional capabilities."
    : "Finish setting up missed-call recovery and see what Transovo is ready to handle.";

  return (
    <Page className="max-w-5xl">
      <PageHeader
        title="Getting started"
        description={headerDescription}
        actions={
          <Button variant="outline" size="sm" render={<Link href={MCTB_ROUTES.home}>Go to Overview</Link>} />
        }
      />

      <Panel
        title={data.recoveryPaused ? "Missed-call recovery is paused" : "Missed-call recovery setup"}
        description={data.usageLine ?? undefined}
        action={
          data.operationalReady ? (
            <Pill tone="success" dot={false}>Essential setup complete</Pill>
          ) : (
            <span className="text-xs tabular-nums text-muted-foreground">
              {data.essentialsComplete} of {data.essentialsTotal} essentials
            </span>
          )
        }
        bodyClassName="space-y-4"
      >
        {!data.operationalReady ? (
          <>
            <SetupProgressBar value={data.essentialsComplete} max={data.essentialsTotal} />
            {data.nextEssentialTitle ? (
              <p className="text-sm text-muted-foreground">
                Next: <span className="font-medium text-foreground">{data.nextEssentialTitle}</span>
              </p>
            ) : null}
            <Button
              type="button"
              size="sm"
              render={
                <Link href={data.continueSetupHref}>
                  {data.nextEssentialId === "setup_test" ? "Run setup test" : "Continue setup"}
                </Link>
              }
            />
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" render={<Link href={MCTB_ROUTES.home}>View Overview</Link>} />
            <Button
              type="button"
              size="sm"
              variant="outline"
              render={<Link href={MCTB_ROUTES.setupTest}>Run setup test</Link>}
            />
          </div>
        )}
        {data.recoveryPaused ? (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button
              type="button"
              size="sm"
              onClick={() => void saveMctbSetup({ enabled: true, pauseUntil: null }).then(() => load())}
            >
              Resume recovery
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              render={<Link href={MCTB_ROUTES.missedCallRecovery}>Review recovery settings</Link>}
            />
          </div>
        ) : null}
      </Panel>

      <section className="mt-8">
        <Panel title="Essential setup" description="Everything required for Missed Call Text Back to operate correctly." bodyClassName="divide-y p-0">
          {data.essentials.map((row) => (
            <div key={row.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <RowIcon tone={row.tone} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.detail}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:pl-4">
                <Pill tone={toneForPill(row.tone)} dot={false}>{row.statusLabel}</Pill>
                <TextLink href={row.href}>{row.actionLabel} →</TextLink>
              </div>
            </div>
          ))}
        </Panel>
      </section>

      {data.attention.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">Needs attention</h2>
          <ul className="mt-3 space-y-2">
            {data.attention.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.message}</p>
                  {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
                </div>
                <TextLink href={item.href}>{item.actionLabel} →</TextLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold">More ways to recover missed calls</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Optional capabilities you can configure as your workflow grows.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.capabilities.map((cap) => (
            <div key={cap.id} className="rounded-lg border bg-card px-4 py-3">
              <div className="flex items-start gap-2">
                <RowIcon tone={cap.tone} locked={cap.locked} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{cap.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{cap.detail}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Pill tone={toneForPill(cap.tone)} dot={false}>{cap.statusLabel}</Pill>
                    {!cap.locked ? <TextLink href={cap.href}>{cap.actionLabel} →</TextLink> : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 border-t pt-8">
        <h2 className="text-sm font-semibold">Help &amp; guides</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <TextLink href={MCTB_ROUTES.phone}>Forwarding your business phone →</TextLink>
            <p className="mt-0.5 text-xs text-muted-foreground">Set up conditional/no-answer forwarding.</p>
          </div>
          <div>
            <TextLink href={`${MCTB_ROUTES.missedCallRecovery}?tab=consent`}>How Press-1 consent works →</TextLink>
            <p className="mt-0.5 text-xs text-muted-foreground">What callers hear and how consent is recorded.</p>
          </div>
          <div>
            <TextLink href={MCTB_ROUTES.textBack}>Text-back and sender guide →</TextLink>
            <p className="mt-0.5 text-xs text-muted-foreground">Transovo Platform vs your own sender.</p>
          </div>
          <div>
            <TextLink href={MCTB_ROUTES.setupTest}>Troubleshooting missed-call recovery →</TextLink>
            <p className="mt-0.5 text-xs text-muted-foreground">What to check if a test call does not recover.</p>
          </div>
          <div>
            <TextLink href="/settings">Contact support →</TextLink>
            <p className="mt-0.5 text-xs text-muted-foreground">Get help with setup or account questions.</p>
          </div>
        </div>
      </section>
    </Page>
  );
}
