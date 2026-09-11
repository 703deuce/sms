"use client";

import { useCallback, useEffect, useState } from "react";
import type { MeetingPoll } from "@/lib/appointments/scheduling-capabilities";

export type MeetingPollWorkspacePayload = {
  workspaceSlug: string;
  workspaceName: string;
  polls: Array<{
    id: string;
    title: string;
    status: string;
    optionCount: number;
    participantCount: number;
    respondedCount: number;
    bestTimeLabel: string | null;
    deadlineAt: string | null;
    updatedAt: string;
    appointmentId: string | null;
  }>;
  pollDetails: Array<
    MeetingPoll & {
      derivedStatus: string;
      publicUrl: string;
      scoreboard: import("@/lib/appointments/meeting-polls/scoring").PollScoreboard;
    }
  >;
};

export type PollDetailPayload = {
  poll: MeetingPoll;
  derivedStatus: string;
  scoreboard: import("@/lib/appointments/meeting-polls/scoring").PollScoreboard;
  publicUrl: string;
};

export function useMeetingPollsWorkspace() {
  const [data, setData] = useState<MeetingPollWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/meeting-polls/workspace");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function useMeetingPollDetail(pollId: string | null) {
  const [data, setData] = useState<PollDetailPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(pollId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!pollId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/meeting-polls/${encodeURIComponent(pollId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Load failed");
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAction = useCallback(
    async (body: Record<string, unknown>) => {
      if (!pollId) throw new Error("No poll");
      const res = await fetch(`/api/appointments/meeting-polls/${encodeURIComponent(pollId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      await reload();
      return json;
    },
    [pollId, reload],
  );

  return { data, loading, error, reload, runAction };
}
