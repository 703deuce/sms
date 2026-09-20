"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useEffect, useState } from "react";

const VOICE_EVENTS = [
  "voice.call.completed",
  "voice.callback.requested",
  "voice.message.received",
  "voice.appointment.booked",
  "voice.appointment.rescheduled",
  "voice.appointment.cancelled",
  "voice.transfer.connected",
  "voice.transfer.failed",
  "voice.emergency.escalated",
];

type HookRow = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  signingSecretPrefix: string | null;
};

type DeliveryRow = {
  id: string;
  eventType: string;
  status: string;
  httpStatus: number | null;
  createdAt: string;
  attemptedAt: string | null;
  errorMessage: string | null;
};

export function VoiceOutboundWebhooksPanel() {
  const [rows, setRows] = useState<HookRow[]>([]);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["voice.call.completed"]);
  const [secretReveal, setSecretReveal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/voice/webhooks");
    const json = await res.json();
    setRows(json.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createHook() {
    const res = await fetch("/api/voice/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, events: selectedEvents }),
    });
    const json = await res.json();
    if (json.signingSecret) setSecretReveal(json.signingSecret);
    setUrl("");
    await load();
  }

  async function sendTest(id: string) {
    await fetch(`/api/voice/webhooks/${id}/test`, { method: "POST" });
  }

  function toggleEvent(ev: string) {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  }

  async function loadDeliveries(webhookId: string) {
    setDeliveriesFor(webhookId);
    setDeliveriesLoading(true);
    const res = await fetch(`/api/voice/webhooks/${webhookId}/deliveries`);
    const json = await res.json();
    setDeliveries(json.data || []);
    setDeliveriesLoading(false);
  }

  return (
    <Card className="mt-6">
      <CardTitle className="mb-2">Voice V3 webhooks</CardTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        Send after-hours call events to your systems. Signed with HMAC SHA-256 (X-Transovo-Signature).
      </p>
      {secretReveal ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          Copy your signing secret now — it will not be shown again:{" "}
          <code className="break-all">{secretReveal}</code>
        </p>
      ) : null}
      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="voice-wh-url">Endpoint URL</Label>
          <Input
            id="voice-wh-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/transovo"
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Events</p>
          <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
            {VOICE_EVENTS.map((ev) => (
              <li key={ev}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                  />
                  {ev}
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Button type="button" onClick={createHook} disabled={!url.trim()}>
        Add endpoint
      </Button>
      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Voice webhooks yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>URL</TH>
                <TH>Events</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((row) => (
                <TR key={row.id}>
                  <TD className="max-w-xs truncate text-xs">{row.url}</TD>
                  <TD className="text-xs">{row.events.join(", ")}</TD>
                  <TD>
                    <StatusChip status={row.active ? "Active" : "Paused"} />
                  </TD>
                  <TD className="space-x-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => sendTest(row.id)}>
                      Send test
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => loadDeliveries(row.id)}
                    >
                      Deliveries
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      {deliveriesFor ? (
        <div className="mt-6 rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Recent deliveries</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDeliveriesFor(null)}>
              Close
            </Button>
          </div>
          {deliveriesLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliveries yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Event</TH>
                  <TH>Status</TH>
                  <TH>HTTP</TH>
                  <TH>Time</TH>
                </TR>
              </THead>
              <TBody>
                {deliveries.map((d) => (
                  <TR key={d.id}>
                    <TD className="text-xs">{d.eventType}</TD>
                    <TD>
                      <StatusChip
                        status={
                          d.status === "delivered"
                            ? "Delivered"
                            : d.status === "failed"
                              ? "Failed"
                              : "Pending"
                        }
                      />
                    </TD>
                    <TD className="text-xs tabular-nums">{d.httpStatus ?? "—"}</TD>
                    <TD className="text-xs text-muted-foreground">
                      {new Date(d.attemptedAt || d.createdAt).toLocaleString()}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      ) : null}
    </Card>
  );
}
