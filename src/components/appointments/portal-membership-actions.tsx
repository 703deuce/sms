"use client";

import { useState } from "react";

type MembershipRow = {
  id: string;
  status?: string;
  product?: { name?: string; billingInterval?: string };
  currentPeriodEnd?: string;
  pausedUntil?: string;
  cancelAtPeriodEnd?: boolean;
};

function formatShortDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function PortalMembershipActions({
  portalToken,
  membership,
  onUpdated,
  onManagePayment,
}: {
  portalToken: string;
  membership: MembershipRow;
  onUpdated: () => void;
  onManagePayment?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelMode, setCancelMode] = useState<"end_of_period" | "immediate">("end_of_period");

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/portal/${portalToken}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: membership.id, ...body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      onUpdated();
      return json.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
      return null;
    } finally {
      setBusy(false);
    }
  }

  const status = membership.status || "active";
  const isPaused = status === "paused";
  const isPastDue = status === "past_due";
  const isCanceled = status === "canceled";
  const isScheduledCancel = status === "cancellation_scheduled" || membership.cancelAtPeriodEnd;

  return (
    <div className="mt-3 space-y-2 border-t pt-3">
      {isPastDue ? (
        <p className="text-sm text-amber-800">
          Payment issue — we couldn&apos;t renew this membership.
        </p>
      ) : null}
      {isScheduledCancel && membership.currentPeriodEnd ? (
        <p className="text-sm text-muted-foreground">
          Cancellation scheduled. Benefits end {formatShortDate(membership.currentPeriodEnd)}.
        </p>
      ) : null}
      {isPaused && membership.pausedUntil ? (
        <p className="text-sm text-muted-foreground">Paused until {formatShortDate(membership.pausedUntil)}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {isPastDue ? (
          <>
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() =>
                void act({ action: "retry_payment" }).then((data) => {
                  if (data?.status === "paid") setMessage("Payment successful. Membership restored.");
                })
              }
            >
              {busy ? "Retrying…" : "Retry payment"}
            </button>
            {onManagePayment ? (
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                disabled={busy}
                onClick={onManagePayment}
              >
                Update payment method
              </button>
            ) : null}
          </>
        ) : null}

        {isScheduledCancel ? (
          <button
            type="button"
            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              void act({ action: "undo_cancel" }).then(() => setMessage("Membership kept active."))
            }
          >
            Keep membership
          </button>
        ) : null}

        {!isCanceled && !isScheduledCancel && !isPaused && status === "active" ? (
          <>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              disabled={busy}
              onClick={() =>
                void act({ action: "pause" }).then(() => setMessage("Membership paused."))
              }
            >
              Pause membership
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm text-destructive disabled:opacity-50"
              disabled={busy}
              onClick={() => setShowCancel((v) => !v)}
            >
              Cancel membership
            </button>
          </>
        ) : null}

        {isPaused ? (
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              void act({ action: "resume" }).then(() => setMessage("Membership resumed."))
            }
          >
            Resume
          </button>
        ) : null}
      </div>

      {showCancel ? (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">Cancel membership</p>
          <p className="text-sm text-muted-foreground">
            {membership.product?.name || "Membership"}
            {membership.currentPeriodEnd ? ` · active until ${formatShortDate(membership.currentPeriodEnd)}` : ""}
          </p>
          <fieldset className="space-y-2 text-sm">
            <legend className="sr-only">Cancellation timing</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`cancel-${membership.id}`}
                checked={cancelMode === "end_of_period"}
                onChange={() => setCancelMode("end_of_period")}
              />
              Cancel at end of billing period
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name={`cancel-${membership.id}`}
                checked={cancelMode === "immediate"}
                onChange={() => setCancelMode("immediate")}
              />
              Cancel immediately
            </label>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-destructive px-3 py-1.5 text-sm text-destructive-foreground disabled:opacity-50"
              disabled={busy}
              onClick={() =>
                void act({ action: "cancel", mode: cancelMode }).then(() => {
                  setShowCancel(false);
                  setMessage(
                    cancelMode === "immediate"
                      ? "Membership canceled."
                      : `Cancellation scheduled for ${formatShortDate(membership.currentPeriodEnd)}.`,
                  );
                })
              }
            >
              Confirm cancellation
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-1.5 text-sm"
              onClick={() => setShowCancel(false)}
            >
              Keep membership
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {message ? <p className="text-sm text-primary" role="status">{message}</p> : null}
    </div>
  );
}
