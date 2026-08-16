"use client";

import { PortNumberForm } from "@/components/numbers/port-number-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { personalPortInStatusLabel } from "@/lib/numbers/port-constants";
import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const PORT_IN_STAGES = [
  "Preparing",
  "Submitted",
  "Carrier Review",
  "Action Required",
  "Scheduled",
  "Completed",
];

function providerLabel(provider?: string) {
  if (provider === "twilio") return "Twilio";
  if (provider === "telnyx") return "Telnyx";
  return "carrier";
}

export function PersonalPortingClient({
  numbers,
  portRequests,
}: {
  numbers: PersonalNumberRow[];
  portRequests: Array<{ id: string; phoneNumber: string; status: string; direction?: string }>;
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "out" ? "out" : "in";
  const [tab, setTab] = useState<"in" | "out">(initialTab);
  const initialNumberId = searchParams.get("numberId") || numbers[0]?.id || "";
  const [selectedId, setSelectedId] = useState(initialNumberId);
  const [accountNumber, setAccountNumber] = useState("");
  const [portPin, setPortPin] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [provider, setProvider] = useState<string>("telnyx");
  const [gainingCarrier, setGainingCarrier] = useState("");
  const [gainingAccountNumber, setGainingAccountNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [portMessage, setPortMessage] = useState<string | null>(null);
  const [loadingCreds, setLoadingCreds] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const selected = numbers.find((n) => n.id === selectedId);
  const portOutRequests = portRequests.filter((p) =>
    (p as { notes?: string }).notes?.includes("direction:out") ||
    p.direction === "out",
  );
  const portInRequests = portRequests.filter(
    (p) => !portOutRequests.some((out) => out.id === p.id),
  );

  useEffect(() => {
    if (!selectedId) return;
    setLoadingCreds(true);
    fetch(`/api/personal/numbers/${selectedId}/port-out`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.accountNumber) setAccountNumber(j.data.accountNumber);
        setPortPin(j.data?.locked ? null : j.data?.pin || null);
        setLocked(j.data?.locked ?? true);
        if (j.data?.provider) setProvider(j.data.provider);
      })
      .catch(() => undefined)
      .finally(() => setLoadingCreds(false));
  }, [selectedId]);

  async function portAction(action: "unlock" | "lock" | "sync") {
    if (!selectedId) return;
    setSubmitting(true);
    setPortMessage(null);
    try {
      const res = await fetch(`/api/personal/numbers/${selectedId}/port-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Port-out update failed.");
      if (j.data?.accountNumber) setAccountNumber(j.data.accountNumber);
      if (j.data?.pin) setPortPin(j.data.pin);
      if (action === "lock") {
        setLocked(true);
        setPortPin(null);
        setPortMessage("Number locked for port-out.");
      } else if (action === "unlock") {
        setLocked(false);
        setPortPin(j.data?.pin || null);
        setPortMessage("Port-out credentials revealed. Share with your new carrier.");
      } else {
        setPortMessage(`Synced from ${providerLabel(j.data?.provider || provider)}.`);
        if (j.data?.provider) setProvider(j.data.provider);
      }
    } catch (e) {
      setPortMessage(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function initiatePortOut() {
    if (!selectedId) return;
    if (!gainingCarrier.trim()) {
      setPortMessage("Enter your new carrier name before submitting.");
      return;
    }
    setSubmitting(true);
    setPortMessage(null);
    try {
      const res = await fetch(`/api/personal/numbers/${selectedId}/port-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate",
          gainingCarrier: gainingCarrier.trim(),
          gainingAccountNumber: gainingAccountNumber.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not start port-out.");
      if (j.data?.accountNumber) setAccountNumber(j.data.accountNumber);
      if (j.data?.pin) {
        setPortPin(j.data.pin);
        setLocked(false);
      }
      if (j.data?.provider) setProvider(j.data.provider);
      setPortMessage(
        "Port-out started. Use the account number and PIN below with your new carrier. Transfer window is open for 7 days.",
      );
    } catch (e) {
      setPortMessage(e instanceof Error ? e.message : "Could not start port-out.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button
          variant={tab === "in" ? "primary" : "outline"}
          size="sm"
          onClick={() => setTab("in")}
        >
          Port In
        </Button>
        <Button
          variant={tab === "out" ? "primary" : "outline"}
          size="sm"
          onClick={() => setTab("out")}
        >
          Port Out
        </Button>
      </div>

      {tab === "in" ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Bring your existing number to Transovo — find a number or bring your number, equal paths
            into the product.
          </p>
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-4 text-sm text-amber-900">
            <strong>Important:</strong> Do not cancel service with your current carrier until your
            port to Transovo is completed. Cancelling first can cause the number to be lost or the
            port to fail.
          </div>
          <PortNumberForm />
          {portInRequests.length > 0 ? (
            <div className="surface rounded-xl p-4">
              <h3 className="text-sm font-semibold">Your port requests</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {portInRequests.map((p) => (
                  <li key={p.id}>
                    {formatPhone(p.phoneNumber)} — {personalPortInStatusLabel(p.status)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Move your Transovo number to another carrier. Unlock credentials, share them with your new
            carrier, then submit the port-out request below.
          </p>
          {numbers.length === 0 ? (
            <EmptyState title="No numbers" description="Add a number before starting a port away." />
          ) : (
            <>
              <div className="surface rounded-xl p-4 space-y-3">
                <label className="text-sm font-semibold">
                  Number to port out
                  <select
                    className="mt-1 block w-full max-w-md rounded-md border px-2 py-2 text-sm"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    {numbers.map((n) => (
                      <option key={n.id} value={n.id}>
                        {formatPhone(n.number)}
                        {n.friendlyName ? ` — ${n.friendlyName}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                {selected ? (
                  <p className="text-xs text-muted-foreground">
                    Carrier: {providerLabel(provider)} · Status: {selected.serviceLabel}
                  </p>
                ) : null}

                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Account number</dt>
                    <dd className="font-mono font-medium">
                      {loadingCreds ? "Loading…" : accountNumber || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Port-out PIN</dt>
                    <dd className="font-mono font-medium">
                      {locked ? "Locked — unlock to reveal" : portPin || "—"}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-2">
                  {locked ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => portAction("unlock")}
                      disabled={submitting}
                    >
                      Unlock for port-out
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => portAction("lock")}
                      disabled={submitting}
                    >
                      Lock number
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => portAction("sync")}
                    disabled={submitting}
                  >
                    Sync from {providerLabel(provider)}
                  </Button>
                  {selectedId ? (
                    <Link href={`/personal/numbers/${selectedId}`}>
                      <Button size="sm" variant="ghost">Number details</Button>
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="surface rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold">Start port-out with new carrier</h3>
                <p className="text-xs text-muted-foreground">
                  Enter your new carrier&apos;s details. We unlock credentials, open a 7-day transfer
                  window, and record the port-out request.
                </p>
                <label className="block text-sm">
                  New carrier name
                  <input
                    className="mt-1 block w-full max-w-md rounded-md border px-2 py-2 text-sm"
                    placeholder="Verizon, AT&T, T-Mobile…"
                    value={gainingCarrier}
                    onChange={(e) => setGainingCarrier(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Account number at new carrier (optional)
                  <input
                    className="mt-1 block w-full max-w-md rounded-md border px-2 py-2 text-sm"
                    placeholder="If your new carrier gave you an account number"
                    value={gainingAccountNumber}
                    onChange={(e) => setGainingAccountNumber(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Notes (optional)
                  <textarea
                    className="mt-1 block w-full max-w-md rounded-md border px-2 py-2 text-sm"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
                <Button size="sm" onClick={initiatePortOut} disabled={submitting || !selectedId}>
                  {submitting ? "Submitting…" : "Submit port-out request"}
                </Button>
                {provider === "twilio" ? (
                  <p className="text-xs text-muted-foreground">
                    US local Twilio numbers may require a carrier-specific PIN from Twilio support.
                    Account number is your Twilio subaccount SID shown above.
                  </p>
                ) : null}
              </div>

              {portOutRequests.length > 0 ? (
                <div className="surface rounded-xl p-4">
                  <h3 className="text-sm font-semibold">Port-out requests</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {portOutRequests.map((p) => (
                      <li key={p.id}>
                        {formatPhone(p.phoneNumber)} — {personalPortInStatusLabel(p.status)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
          {portMessage ? <p className="text-xs text-muted-foreground">{portMessage}</p> : null}
          <p className="text-xs text-muted-foreground">
            Status flow: {PORT_IN_STAGES.join(" → ")}
          </p>
        </div>
      )}
    </div>
  );
}
