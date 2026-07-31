"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";

type ListOption = { id: string; name: string; contactCount: number };

function computeNextRun(
  nextRunAt: string,
  frequency: "daily" | "weekly" | "monthly",
  interval: number,
): Date | null {
  if (!nextRunAt) return null;
  const first = new Date(nextRunAt);
  if (Number.isNaN(first.getTime())) return null;
  const now = new Date();
  const step = Math.max(1, interval || 1);
  const next = new Date(first);
  // Advance to the first occurrence in the future.
  let guard = 0;
  while (next <= now && guard < 1000) {
    if (frequency === "daily") next.setDate(next.getDate() + step);
    else if (frequency === "weekly") next.setDate(next.getDate() + 7 * step);
    else next.setMonth(next.getMonth() + step);
    guard += 1;
  }
  return next;
}

export function RecurringCampaignForm() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Hi {{first_name}}, here's your weekly update!");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [interval, setInterval] = useState(1);
  const [nextRunAt, setNextRunAt] = useState("");
  const [listId, setListId] = useState("");
  const [lists, setLists] = useState<ListOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/contacts/lists")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setLists(j.data || []))
      .catch(() => setLists([]));
  }, []);

  const nextRun = useMemo(
    () => computeNextRun(nextRunAt, frequency, interval),
    [nextRunAt, frequency, interval],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setDone(false);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message,
          category: "broadcast",
          audience: listId ? "List" : "Custom",
          config: {
            listId: listId || undefined,
            recurrence: {
              frequency,
              interval: Number(interval) || 1,
              nextRunAt: new Date(nextRunAt).toISOString(),
              listId: listId || undefined,
            },
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create");
      setDone(true);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <CardTitle>Create recurring campaign</CardTitle>
      <form className="mt-4 space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor="rc-name">Name</Label>
          <Input id="rc-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rc-message">Message</Label>
          <Textarea
            id="rc-message"
            required
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="rc-freq">Frequency</Label>
            <Select
              id="rc-freq"
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as "daily" | "weekly" | "monthly")
              }
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="rc-interval">Every (interval)</Label>
            <Input
              id="rc-interval"
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setInterval(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="rc-next">First run</Label>
          <Input
            id="rc-next"
            type="datetime-local"
            required
            value={nextRunAt}
            onChange={(e) => setNextRunAt(e.target.value)}
          />
          {nextRun ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Next run: {nextRun.toLocaleString()}
            </p>
          ) : null}
        </div>
        <div>
          <Label htmlFor="rc-list">Contact list</Label>
          <Select id="rc-list" value={listId} onChange={(e) => setListId(e.target.value)}>
            <option value="">— select a list —</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.contactCount})
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            Every run enrolls the contacts in this list.
          </p>
        </div>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {done ? <p className="text-sm text-emerald-600">Recurring campaign created.</p> : null}
        <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create recurring"}</Button>
      </form>
    </Card>
  );
}
