"use client";

import { useEffect, useState } from "react";

export default function ClientPortalPublicClient({ token }: { token: string }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/public/portal/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Invalid portal link");
        setData(json.data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [token]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-xl font-semibold">Client portal</h1>
        <p className="mt-4 text-sm text-destructive">{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      </main>
    );
  }

  const appointments = (data.appointments as Array<Record<string, unknown>>) || [];
  const entitlements = data.entitlements as Record<string, unknown>;

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Your appointments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upcoming visits, packages, memberships, and gift balances.
        </p>
      </header>

      <section>
        <h2 className="text-lg font-medium">Upcoming & past appointments</h2>
        <ul className="mt-3 divide-y rounded-lg border">
          {appointments.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No appointments yet.</li>
          ) : (
            appointments.map((a) => (
              <li key={String(a.id)} className="flex justify-between gap-4 p-4 text-sm">
                <span>{String(a.serviceName || "Appointment")}</span>
                <span className="text-muted-foreground">{String(a.startsAt)}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-medium">Entitlements</h2>
        <pre className="mt-3 overflow-auto rounded-lg border bg-muted/30 p-4 text-xs">
          {JSON.stringify(entitlements, null, 2)}
        </pre>
      </section>
    </main>
  );
}
