"use client";

import { useCallback, useEffect, useState } from "react";

type ClassSeries = { id: string; name: string; description: string | null; capacity: number };
type ClassOccurrence = {
  id: string;
  seriesId: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  enrolled: number;
  remaining: number;
};

export function PublicClassesEnrollmentClient({
  slug,
  businessName,
}: {
  slug: string;
  businessName: string;
}) {
  const [series, setSeries] = useState<ClassSeries[]>([]);
  const [occurrences, setOccurrences] = useState<ClassOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/book/${slug}/classes`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load classes");
      setSeries(json.data?.series || []);
      setOccurrences(json.data?.occurrences || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enroll(occurrenceId: string) {
    if (!firstName.trim() || !phone.trim()) {
      setError("First name and phone are required.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/public/book/${slug}/classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occurrenceId,
          firstName,
          lastName,
          phone,
          email: email || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Enrollment failed");
      setMessage("You are enrolled. We will send a confirmation if messaging is enabled.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  function formatWhen(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const seriesMap = new Map(series.map((s) => [s.id, s]));

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Classes</h1>
        <p className="mt-1 text-sm text-muted-foreground">{businessName}</p>
      </header>

      <section className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Your details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted-foreground">First name *</span>
            <input className="mt-1 h-9 w-full rounded-md border px-2" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Last name</span>
            <input className="mt-1 h-9 w-full rounded-md border px-2" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Phone *</span>
            <input className="mt-1 h-9 w-full rounded-md border px-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Email</span>
            <input type="email" className="mt-1 h-9 w-full rounded-md border px-2" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
      </section>

      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading upcoming classes…</p>
      ) : occurrences.length === 0 ? (
        <p className="text-sm text-muted-foreground">No upcoming class sessions.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {occurrences.map((occ) => {
            const s = seriesMap.get(occ.seriesId);
            const full = occ.remaining <= 0;
            return (
              <li key={occ.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{s?.name || "Class"}</p>
                  <p className="text-sm text-muted-foreground">{formatWhen(occ.startsAt)}</p>
                  <p className="text-xs text-muted-foreground">
                    {full ? "Full" : `${occ.remaining} spot${occ.remaining === 1 ? "" : "s"} left`}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy || full}
                  className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                  onClick={() => void enroll(occ.id)}
                >
                  Enroll
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
