"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
  MCTB_PRO_MONTHLY_RECOVERY_LIMIT,
} from "@/lib/mctb/recovery-usage-constants";
import {
  MCTB_OWN_NUMBER_STACKING_SUMMARY,
  MCTB_PRO_MONTHLY_CENTS,
} from "@/lib/mctb/commercial-pricing";
import { startPlatformProductCheckout } from "@/lib/mctb/start-platform-checkout";
import { formatCurrency } from "@/lib/utils";
import { EmptyState, Panel, Pill, Stat } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { AlertTriangle, CreditCard } from "lucide-react";
import type { MctbPlanUsagePresentation } from "@/lib/mctb/plan-display";

type PlatformSubRow = {
  productFamily: string;
  tier: string;
  status: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
};

type Props = { highlightProduct?: string | null };

export function MctbBillingSettingsOpus({ highlightProduct }: Props) {
  const [planUsage, setPlanUsage] = useState<MctbPlanUsagePresentation | null>(null);
  const [mctbSub, setMctbSub] = useState<PlatformSubRow | null>(null);
  const [ownSenderSub, setOwnSenderSub] = useState<PlatformSubRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    return Promise.all([
      fetch("/api/mctb/shell-context", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/platform/billing/catalog").then((r) => r.json()),
    ])
      .then(([shellJson, catJson]) => {
        const shell = shellJson.data ?? shellJson;
        setPlanUsage(shell.planUsage ?? null);
        const subs = (catJson.data?.subscriptions ?? []) as PlatformSubRow[];
        setMctbSub(subs.find((s) => s.productFamily === "mctb") ?? null);
        setOwnSenderSub(subs.find((s) => s.productFamily === "mctb_own_sender") ?? null);
        if (!shell.planUsage) setFailed(true);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isPro = planUsage?.planKey === "pro" || planUsage?.planKey === "ai_recovery";
  const mctbActive =
    mctbSub && ["active", "trialing", "past_due"].includes(mctbSub.status);

  const periodEndLabel = useMemo(() => {
    if (!mctbSub?.currentPeriodEnd) return null;
    try {
      return new Date(mctbSub.currentPeriodEnd).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return null;
    }
  }, [mctbSub?.currentPeriodEnd]);

  async function openStripePortal() {
    setBusy("portal");
    setMessage(null);
    try {
      const res = await fetch("/api/settings/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stripe_portal" }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setMessage({ text: json.error || "Billing portal is not available.", kind: "error" });
    } catch {
      setMessage({ text: "Could not open billing portal.", kind: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function startCheckout(productKey: string) {
    setBusy(productKey);
    setMessage(null);
    try {
      await startPlatformProductCheckout({
        productKey,
        successPath: "/settings/billing?platform_checkout=success",
      });
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "Checkout could not start.",
        kind: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function manageSubscription(action: "cancel_at_period_end" | "cancel_now" | "resume") {
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch("/api/platform/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productFamily: "mctb", action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update subscription.");
      if (action === "cancel_at_period_end") {
        setMessage({
          text: periodEndLabel
            ? `Pro stays active until ${periodEndLabel}, then returns to Free.`
            : "Pro will end at the close of this billing period, then you return to Free.",
          kind: "success",
        });
      } else if (action === "cancel_now") {
        setMessage({
          text: "Pro subscription ended. You are on the Free plan.",
          kind: "success",
        });
      } else {
        setMessage({ text: "Pro subscription renewed — cancellation removed.", kind: "success" });
      }
      await load();
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : "Could not update subscription.",
        kind: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading billing…</p>;
  }

  if (failed || !planUsage) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Billing couldn't be loaded"
        description="Try loading it again."
        action={
          <Button type="button" variant="outline" onClick={() => void load()}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {highlightProduct ? (
        <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm">
          Review billing for {highlightProduct.replace(/_/g, " ")}.
        </p>
      ) : null}
      {message ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${message.kind === "success" ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10 text-destructive"}`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Current plan" value={planUsage.planLabel} hint="Missed Call Text Back" />
        <Stat
          label="Recoveries this month"
          value={planUsage.usageShortLabel}
          hint="Replies are not counted"
        />
        <Stat
          label="Pro price"
          value={formatCurrency(MCTB_PRO_MONTHLY_CENTS / 100)}
          hint="per month"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Free"
          description={`${MCTB_FREE_MONTHLY_RECOVERY_LIMIT} recoveries per month · email team alerts · platform toll-free sender.`}
        >
          {!isPro ? (
            <Pill tone="success" dot={false}>Your current plan</Pill>
          ) : (
            <p className="text-sm text-muted-foreground">
              Included after you downgrade from Pro.
            </p>
          )}
        </Panel>

        <Panel
          title="Pro"
          description={`${MCTB_PRO_MONTHLY_RECOVERY_LIMIT} recoveries per month · email + SMS team alerts · booking links · analytics · all recovery strategies.`}
        >
          <p className="text-lg font-semibold tabular-nums">
            {formatCurrency(MCTB_PRO_MONTHLY_CENTS / 100)}
            <span className="text-sm font-normal text-muted-foreground"> / month</span>
          </p>
          {isPro ? (
            <div className="mt-3 space-y-2">
              <Pill tone="success" dot={false}>Active</Pill>
              {mctbSub?.cancelAtPeriodEnd ? (
                <p className="text-sm text-muted-foreground">
                  Cancels{periodEndLabel ? ` on ${periodEndLabel}` : " at period end"} — you keep Pro until then.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-1">
                {mctbActive && mctbSub?.cancelAtPeriodEnd ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void manageSubscription("resume")}
                  >
                    {busy === "resume" ? "Saving…" : "Keep Pro"}
                  </Button>
                ) : null}
                {mctbActive && !mctbSub?.cancelAtPeriodEnd ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void manageSubscription("cancel_at_period_end")}
                  >
                    {busy === "cancel_at_period_end" ? "Scheduling…" : "Downgrade to Free at period end"}
                  </Button>
                ) : null}
                {mctbActive ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy !== null}
                    onClick={() => void manageSubscription("cancel_now")}
                  >
                    {busy === "cancel_now" ? "Ending…" : "End Pro now"}
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => void openStripePortal()}>
                  {busy === "portal" ? "Opening…" : "Payment method & invoices"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() => void startCheckout("mctb_pro")}
              >
                <CreditCard className="mr-2 size-4" aria-hidden />
                {busy === "mctb_pro" ? "Redirecting…" : "Upgrade to Pro"}
              </Button>
              <Button type="button" variant="outline" render={<Link href="/mctb/billing/checkout?product=mctb_pro" />}>
                Open checkout page
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Own local number (optional)" description={MCTB_OWN_NUMBER_STACKING_SUMMARY}>
        {ownSenderSub && ["active", "trialing", "past_due"].includes(ownSenderSub.status) ? (
          <Pill tone="success" dot={false}>Add-on active</Pill>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void startCheckout("mctb_own_sender")}
          >
            {busy === "mctb_own_sender" ? "Redirecting…" : "Add own number + A2P"}
          </Button>
        )}
      </Panel>
    </div>
  );
}
