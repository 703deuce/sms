"use client";

import { useEffect, useState } from "react";

export default function ManageAppointmentPage({ token }: { token: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`/api/public/manage/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Invalid link");
        setData(json.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  async function act(action: "cancel" | "reschedule") {
    setBusy(true);
    setError(null);
    try {
      const body =
        action === "reschedule"
          ? { action, startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString() }
          : { action };
      const res = await fetch(`/api/public/manage/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold">Manage appointment</h1>
        <p className="mt-4 text-sm text-destructive">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <p className="text-sm text-muted-foreground">Loading appointment…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Manage appointment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View, reschedule, or cancel without signing in.
        </p>
      </header>

      <section className="rounded-lg border p-4 text-sm">
        <dl className="space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Service</dt>
            <dd>{String(data.serviceName || data.service || "Appointment")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">When</dt>
            <dd>{String(data.startsAt || "")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{String(data.status || "")}</dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          onClick={() => void act("reschedule")}
        >
          Reschedule
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border px-4 py-2 text-sm"
          onClick={() => void act("cancel")}
        >
          Cancel
        </button>
      </div>
    </main>
  );
}
