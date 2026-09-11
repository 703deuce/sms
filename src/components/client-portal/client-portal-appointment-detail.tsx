"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "@/components/client-portal/client-portal.css";

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function ClientPortalAppointmentDetail({ appointmentId }: { appointmentId: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch(`/api/client/portal/appointments/${appointmentId}`, { credentials: "include" })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Not found");
        setData(json.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [appointmentId]);

  async function act(action: string, extra?: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/client/portal/appointments/${appointmentId}/actions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      if (json.data?.checkoutUrl) {
        window.location.href = json.data.checkoutUrl;
        return;
      }
      if (json.data?.managePath) {
        window.location.href = json.data.managePath;
        return;
      }
      setData(json.data);
      setMessage("Updated.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="client-portal-root client-portal-main">
        <p>{error}</p>
        <Link href="/client">Back</Link>
      </div>
    );
  }

  if (!data) {
    return <div className="client-portal-root client-portal-main">Loading…</div>;
  }

  const payment = data.payment as { balanceDueCents: number; amountPaidCents: number; totalPriceCents: number };

  return (
    <div className="client-portal-root">
      <main className="client-portal-main">
        <Link href="/client" className="text-sm" style={{ color: "var(--cp-accent)" }}>← Back</Link>
        <h1 className="mt-3 text-2xl font-semibold">{String(data.title)}</h1>
        <p className="mt-1" style={{ color: "var(--cp-muted)" }}>{fmt(String(data.startsAt))}</p>
        {data.staffName && <p className="text-sm">{String(data.staffName)}</p>}
        {data.location && <p className="text-sm">{String(data.location)}</p>}
        {data.meetingLink && (
          <a href={String(data.meetingLink)} className="client-portal-btn client-portal-btn-primary mt-3 inline-flex" target="_blank" rel="noreferrer">
            Join meeting
          </a>
        )}

        <div className="client-portal-card mt-4 text-sm">
          <p>Status: <strong>{String(data.status)}</strong></p>
          <p className="mt-2">
            Paid {money(payment.amountPaidCents || 0)}
            {payment.balanceDueCents > 0 ? ` · ${money(payment.balanceDueCents)} due` : ""}
          </p>
        </div>

        {message && <p className="mt-3 text-sm text-teal-800">{message}</p>}

        <div className="sticky bottom-20 mt-6 flex flex-col gap-2">
          {payment.balanceDueCents > 0 && (
            <button type="button" className="client-portal-btn client-portal-btn-primary w-full" disabled={busy} onClick={() => void act("pay_balance")}>
              Pay {money(payment.balanceDueCents)}
            </button>
          )}
          {data.canReschedule && (
            <>
              <input
                type="datetime-local"
                className="w-full rounded-lg border px-3 py-2"
                value={rescheduleAt}
                onChange={(e) => setRescheduleAt(e.target.value)}
              />
              <button
                type="button"
                className="client-portal-btn client-portal-btn-secondary w-full"
                disabled={busy || !rescheduleAt}
                onClick={() => void act("reschedule", { startsAt: new Date(rescheduleAt).toISOString() })}
              >
                Reschedule
              </button>
              <button type="button" className="client-portal-btn client-portal-btn-secondary w-full" disabled={busy} onClick={() => void act("manage_token")}>
                Full reschedule (availability)
              </button>
            </>
          )}
          {!data.canReschedule && data.rescheduleBlockedReason && (
            <p className="text-sm" style={{ color: "var(--cp-muted)" }}>{String(data.rescheduleBlockedReason)}</p>
          )}
          {data.canCancel && (
            <button
              type="button"
              className="client-portal-btn client-portal-btn-secondary w-full"
              disabled={busy}
              onClick={() => {
                if (confirm("Cancel this appointment?")) void act("cancel");
              }}
            >
              Cancel appointment
            </button>
          )}
          {!data.canCancel && data.cancelBlockedReason && (
            <p className="text-sm" style={{ color: "var(--cp-muted)" }}>{String(data.cancelBlockedReason)}</p>
          )}
        </div>
      </main>
    </div>
  );
}
