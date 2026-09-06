"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function MeetingPollsClient() {
  const [polls, setPolls] = useState<Array<{ id: string; title: string; status: string; options: Array<{ id: string; startsAt: string; votes: number }> }>>([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    fetch("/api/appointments/meeting-polls").then((r) => r.json()).then((j) => setPolls(j.data || []));
  }, []);

  async function createPoll() {
    await fetch("/api/appointments/meeting-polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        options: [
          { startsAt: new Date(Date.now() + 86400000).toISOString(), endsAt: new Date(Date.now() + 90000000).toISOString() },
          { startsAt: new Date(Date.now() + 172800000).toISOString(), endsAt: new Date(Date.now() + 176400000).toISOString() },
        ],
      }),
    });
    const res = await fetch("/api/appointments/meeting-polls");
    const json = await res.json();
    setPolls(json.data || []);
    setTitle("");
  }

  return (
    <div className="px-6 py-6 lg:px-8 max-w-3xl">
      <h1 className="font-display text-2xl font-semibold mb-6">Meeting polls</h1>
      <Card className="p-5 mb-6">
        <Label>Poll title</Label>
        <div className="flex gap-2 mt-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Team sync times" />
          <Button onClick={createPoll} disabled={!title.trim()}>Create</Button>
        </div>
      </Card>
      {polls.map((poll) => (
        <Card key={poll.id} className="p-5 mb-3">
          <CardTitle className="text-base">{poll.title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{poll.status}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {poll.options.map((o) => (
              <li key={o.id}>{new Date(o.startsAt).toLocaleString()} — {o.votes} votes</li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
