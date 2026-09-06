"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { RecallCampaign } from "@/lib/appointments/scheduling-capabilities";

export function RecallCampaignsClient() {
  const [campaigns, setCampaigns] = useState<RecallCampaign[]>([]);
  const [selected, setSelected] = useState<RecallCampaign | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(() => {
    fetch("/api/appointments/recall-campaigns")
      .then((r) => r.json())
      .then((j) => {
        setCampaigns(j.data || []);
        if (!selected && j.data?.[0]) setSelected(j.data[0]);
      });
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!selected) return;
    setActing(true);
    await fetch("/api/appointments/recall-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign: selected }),
    });
    setActing(false);
    load();
  }

  async function run(id: string) {
    setActing(true);
    const res = await fetch("/api/appointments/recall-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run", campaignId: id }),
    });
    const json = await res.json();
    setActing(false);
    if (json.data) alert(`Sent ${json.data.sent} of ${json.data.targeted} targeted contacts`);
    load();
  }

  async function create() {
    setActing(true);
    const res = await fetch("/api/appointments/recall-campaigns", { method: "POST", body: "{}" });
    const json = await res.json();
    setActing(false);
    if (json.data) {
      setSelected(json.data);
      load();
    }
  }

  return (
    <div className="px-6 py-6 lg:px-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Recall & reactivation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Target customers by last visit or appointment type with SMS or email campaigns.
          </p>
        </div>
        <Button onClick={create} disabled={acting}>New campaign</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2">
          {campaigns.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selected?.id === c.id ? "border-primary bg-primary/5" : ""}`}
              onClick={() => setSelected(c)}
            >
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.channel} · {c.active ? "Active" : "Paused"}</p>
            </button>
          ))}
        </div>

        {selected ? (
          <Card className="lg:col-span-2 p-5 space-y-4">
            <CardTitle className="text-base">Edit campaign</CardTitle>
            <div>
              <Label>Name</Label>
              <Input className="mt-1" value={selected.name} onChange={(e) => setSelected({ ...selected, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Channel</Label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={selected.channel}
                  onChange={(e) => setSelected({ ...selected, channel: e.target.value as "sms" | "email" })}
                >
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <div>
                <Label>Days since last visit</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={selected.segment?.lastVisitDaysAgo ?? 90}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      segment: { ...selected.segment, lastVisitDaysAgo: Number(e.target.value) || 90 },
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Appointment type (optional)</Label>
              <Input
                className="mt-1"
                placeholder="Service name filter"
                value={selected.segment?.appointmentTypeName || ""}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    segment: { ...selected.segment, appointmentTypeName: e.target.value || undefined },
                  })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.segment?.noFutureAppointment !== false}
                onChange={(e) =>
                  setSelected({
                    ...selected,
                    segment: { ...selected.segment, noFutureAppointment: e.target.checked },
                  })
                }
              />
              Only contacts with no upcoming appointment
            </label>
            {selected.channel === "email" ? (
              <div>
                <Label>Subject</Label>
                <Input className="mt-1" value={selected.subject || ""} onChange={(e) => setSelected({ ...selected, subject: e.target.value })} />
              </div>
            ) : null}
            <div>
              <Label>Message</Label>
              <Textarea
                className="mt-1"
                rows={4}
                value={selected.messageTemplate}
                onChange={(e) => setSelected({ ...selected, messageTemplate: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.active} onChange={(e) => setSelected({ ...selected, active: e.target.checked })} />
              Active
            </label>
            <div className="flex gap-2">
              <Button onClick={save} disabled={acting}>Save</Button>
              <Button variant="outline" onClick={() => run(selected.id)} disabled={acting}>Run now</Button>
            </div>
            {selected.lastRunAt ? (
              <p className="text-xs text-muted-foreground">
                Last run: {new Date(selected.lastRunAt).toLocaleString()} — sent {selected.lastRunSent || 0}
              </p>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
