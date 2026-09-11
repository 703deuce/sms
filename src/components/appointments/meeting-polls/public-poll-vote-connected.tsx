"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MeetingPollVoteValue } from "@/lib/appointments/scheduling-capabilities";

type PublicOption = { id: string; startsAt: string; endsAt: string };

export function PublicPollVoteConnected({
  workspaceSlug,
  inviteToken,
}: {
  workspaceSlug: string;
  inviteToken: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<{
    workspace: { name: string };
    poll: {
      title: string;
      description?: string;
      durationMinutes: number;
      timezone: string;
      deadlineAt?: string;
      derivedStatus: string;
      options: PublicOption[];
      settings: { allowMaybe: boolean; allowComments: boolean };
    };
    participant: { id: string; name: string };
    responses: Array<{ optionId: string; value: MeetingPollVoteValue }>;
  } | null>(null);
  const [timezone, setTimezone] = useState(
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "America/New_York",
  );
  const [votes, setVotes] = useState<Record<string, MeetingPollVoteValue>>({});
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/public/book/${encodeURIComponent(workspaceSlug)}/meeting-poll/vote/${encodeURIComponent(inviteToken)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Invalid link");
      setPayload(json.data);
      const initial: Record<string, MeetingPollVoteValue> = {};
      for (const r of json.data.responses || []) initial[r.optionId] = r.value;
      setVotes(initial);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load poll");
    } finally {
      setLoading(false);
    }
  }, [workspaceSlug, inviteToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = useMemo(
    () => (iso: string) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(iso)),
    [timezone],
  );

  async function submit() {
    if (!payload) return;
    const responses = Object.entries(votes).map(([optionId, value]) => ({ optionId, value }));
    const res = await fetch(
      `/api/public/book/${encodeURIComponent(workspaceSlug)}/meeting-poll/vote/${encodeURIComponent(inviteToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responses, comment }),
      },
    );
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Save failed");
      return;
    }
    setSubmitted(true);
  }

  if (loading) {
    return <div className="mx-auto max-w-lg p-6 text-sm text-neutral-600">Loading poll…</div>;
  }

  if (error && !payload) {
    return <div className="mx-auto max-w-lg p-6 text-sm text-red-600" role="alert">{error}</div>;
  }

  if (!payload) return null;

  const status = payload.poll.derivedStatus;
  if (status === "cancelled") {
    return <div className="mx-auto max-w-lg p-6 text-sm">This scheduling poll was cancelled.</div>;
  }
  if (status === "closed") {
    return <div className="mx-auto max-w-lg p-6 text-sm">Voting has closed.</div>;
  }
  if (status === "finalized") {
    return <div className="mx-auto max-w-lg p-6 text-sm">This meeting has been scheduled. Check your email for details.</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white px-4 py-8 text-sm text-neutral-900">
      <p className="text-xs text-neutral-500">{payload.workspace.name}</p>
      <h1 className="mt-1 text-xl font-semibold">{payload.poll.title}</h1>
      {payload.poll.description && <p className="mt-2 text-neutral-600">{payload.poll.description}</p>}
      <p className="mt-2 text-neutral-500">{payload.poll.durationMinutes} minutes</p>

      <label className="mt-4 block text-xs">
        Timezone
        <input
          className="mt-1 w-full rounded border border-neutral-200 px-3 py-2"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          aria-label="Timezone"
        />
      </label>

      <div className="mt-6 space-y-4">
        {payload.poll.options.map((opt) => (
          <div key={opt.id} className="rounded-lg border border-neutral-200 p-3">
            <div className="font-medium">{fmt(opt.startsAt)}</div>
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Your availability">
              {(["yes", "maybe", "no"] as MeetingPollVoteValue[]).map((v) => {
                if (v === "maybe" && !payload.poll.settings.allowMaybe) return null;
                const label = v === "yes" ? "Yes" : v === "maybe" ? "Maybe" : "No";
                const selected = votes[opt.id] === v;
                return (
                  <button
                    key={v}
                    type="button"
                    className={`min-h-[44px] flex-1 rounded-md border px-3 py-2 ${selected ? "border-teal-600 bg-teal-50 text-teal-900" : "border-neutral-200"}`}
                    aria-pressed={selected}
                    onClick={() => setVotes((prev) => ({ ...prev, [opt.id]: v }))}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {payload.poll.settings.allowComments && (
        <label className="mt-4 block">
          Optional note
          <textarea className="mt-1 w-full rounded border border-neutral-200 px-3 py-2" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
      )}

      {error && <p className="mt-2 text-red-600" role="alert">{error}</p>}

      <button
        type="button"
        className="mt-6 w-full min-h-[48px] rounded-md bg-neutral-900 px-4 py-3 font-medium text-white"
        onClick={() => void submit()}
        disabled={submitted}
      >
        {submitted ? "Availability saved" : "Submit availability"}
      </button>
    </div>
  );
}
