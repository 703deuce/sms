"use client";

import { useCallback, useEffect, useState } from "react";

type PollOption = { id: string; startsAt: string; endsAt: string; votes: number };
type PollData = {
  id: string;
  title: string;
  status: string;
  bookedAppointmentId?: string;
  options: PollOption[];
};

function formatWhen(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = `${start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  return `${date} · ${time}`;
}

export function PublicPollVoteClient({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/polls/${encodeURIComponent(pollId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Poll not found");
      setPoll(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load poll");
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!selected) {
      setError("Please select a time.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/polls/${encodeURIComponent(pollId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId: selected }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not submit response");
      if (json.data?.scheduled) {
        setMessage("This meeting has already been scheduled.");
      } else {
        setMessage("Thanks — your availability has been recorded.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <p className="text-sm text-muted-foreground">Loading poll…</p>
      </main>
    );
  }

  if (error && !poll) {
    return (
      <main className="mx-auto max-w-lg p-6">
        <h1 className="text-xl font-semibold">Meeting poll</h1>
        <p className="mt-4 text-sm text-destructive">{error}</p>
      </main>
    );
  }

  if (!poll) return null;

  const scheduled = poll.status === "booked" && poll.bookedAppointmentId;

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">{poll.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {scheduled ? "Meeting scheduled" : "Which times work for you?"}
        </p>
      </header>

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

      {scheduled ? (
        <p className="text-sm text-muted-foreground">
          The organizer has finalized a time. Voting is closed.
        </p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="sr-only">Candidate times</legend>
          {poll.options.map((opt) => (
            <label
              key={opt.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="poll-option"
                value={opt.id}
                checked={selected === opt.id}
                onChange={() => setSelected(opt.id)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{formatWhen(opt.startsAt, opt.endsAt)}</span>
                <span className="text-xs text-muted-foreground">Available</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {!scheduled ? (
        <button
          type="button"
          disabled={busy || !selected}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          onClick={() => void submit()}
        >
          {busy ? "Submitting…" : "Submit availability"}
        </button>
      ) : null}
    </main>
  );
}
