"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  VOICE_WEBHOOK_EVENT_LABELS,
  VOICE_WEBHOOK_SUBSCRIPTION_EVENT_TYPES,
} from "@/lib/voice-v3/webhooks/events";
import { Webhook } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type IntegrationEndpoint = {
  id: string;
  name: string;
  incomingUrl: string;
  active: boolean;
  createdAt: string;
  lastEventAt: string | null;
  successRate: number | null;
};

type OutboundWebhook = {
  id: string;
  url: string;
  label?: string;
  events: string[];
  active: boolean;
  signingSecretPrefix?: string | null;
};

type Props = {
  endpoints: IntegrationEndpoint[];
  outbound: OutboundWebhook[];
};

const subscriptionOptions = VOICE_WEBHOOK_SUBSCRIPTION_EVENT_TYPES.map((value) => ({
  value,
  label: VOICE_WEBHOOK_EVENT_LABELS[value],
}));

export function WebhooksPanel({ endpoints: initialEndpoints, outbound: initialOutbound }: Props) {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [outbound, setOutbound] = useState(initialOutbound);
  const [incomingName, setIncomingName] = useState("");
  const [incomingCreating, setIncomingCreating] = useState(false);
  const [outboundLabel, setOutboundLabel] = useState("");
  const [outboundUrl, setOutboundUrl] = useState("");
  const [outboundEvents, setOutboundEvents] = useState<string[]>(["voice.call.completed"]);
  const [outboundCreating, setOutboundCreating] = useState(false);
  const [outboundSecret, setOutboundSecret] = useState<string | null>(null);
  const [error, setError] = useState("");

  const outboundRows = useMemo(
    () =>
      outbound.map((w) => ({
        id: w.id,
        url: w.url,
        label: w.label || w.url,
        events: w.events,
        status: w.active ? ("Active" as const) : ("Paused" as const),
      })),
    [outbound],
  );

  async function refreshIncoming() {
    const res = await fetch("/api/integrations/webhooks");
    if (!res.ok) return;
    const json = await res.json();
    setEndpoints(
      (json.data || []).map(
        (e: { id: string; name: string; incomingUrl: string; active: boolean; createdAt: string }) => ({
          id: e.id,
          name: e.name,
          incomingUrl: e.incomingUrl,
          active: e.active,
          createdAt: e.createdAt,
          lastEventAt: null,
          successRate: null,
        }),
      ),
    );
  }

  async function refreshOutbound() {
    const res = await fetch("/api/integrations/webhooks/voice");
    if (!res.ok) return;
    const json = await res.json();
    setOutbound(json.data || []);
  }

  async function createIncomingEndpoint() {
    if (!incomingName.trim()) return;
    setIncomingCreating(true);
    setError("");
    try {
      const res = await fetch("/api/integrations/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: incomingName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create endpoint");
      setIncomingName("");
      await refreshIncoming();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create endpoint");
    } finally {
      setIncomingCreating(false);
    }
  }

  async function createOutboundEndpoint() {
    if (!outboundLabel.trim() || !outboundUrl.trim() || !outboundEvents.length) return;
    setOutboundCreating(true);
    setError("");
    setOutboundSecret(null);
    try {
      const res = await fetch("/api/integrations/webhooks/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          label: outboundLabel.trim(),
          url: outboundUrl.trim(),
          events: outboundEvents,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create outbound endpoint");
      setOutboundLabel("");
      setOutboundUrl("");
      setOutboundEvents(["voice.call.completed"]);
      if (json.data?.signingSecret) {
        setOutboundSecret(json.data.signingSecret);
      }
      await refreshOutbound();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create outbound endpoint");
    } finally {
      setOutboundCreating(false);
    }
  }

  async function toggleOutbound(id: string, active: boolean) {
    setError("");
    const res = await fetch("/api/integrations/webhooks/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", webhookId: id, active }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Update failed");
      return;
    }
    await refreshOutbound();
    router.refresh();
  }

  async function testOutbound(id: string) {
    setError("");
    const res = await fetch("/api/integrations/webhooks/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", webhookId: id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Test delivery failed to queue");
      return;
    }
  }

  async function deleteOutbound(id: string) {
    setError("");
    const res = await fetch("/api/integrations/webhooks/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", webhookId: id }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Delete failed");
      return;
    }
    await refreshOutbound();
    router.refresh();
  }

  function toggleEvent(event: string) {
    setOutboundEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  return (
    <>
      <Card className="mb-4">
        <div className="mb-2 flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" />
          <CardTitle>Outbound webhooks</CardTitle>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Send Voice events from Transovo to another system.
        </p>
        {outboundRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outbound Voice endpoints yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Label</TH>
                <TH>Endpoint URL</TH>
                <TH>Events</TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {outboundRows.map((endpoint) => (
                <TR key={endpoint.id}>
                  <TD className="font-medium">{endpoint.label}</TD>
                  <TD className="max-w-[200px] truncate font-mono text-sm">{endpoint.url}</TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {endpoint.events.map((event) => (
                        <span
                          key={event}
                          className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {VOICE_WEBHOOK_EVENT_LABELS[event as keyof typeof VOICE_WEBHOOK_EVENT_LABELS] ||
                            event}
                        </span>
                      ))}
                    </div>
                  </TD>
                  <TD>
                    <StatusChip status={endpoint.status} />
                  </TD>
                  <TD className="space-x-1 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => testOutbound(endpoint.id)}
                    >
                      Send test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => toggleOutbound(endpoint.id, endpoint.status !== "Active")}
                    >
                      {endpoint.status === "Active" ? "Pause" : "Activate"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => deleteOutbound(endpoint.id)}
                    >
                      Delete
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card className="mb-4">
        <CardTitle>Add outbound Voice endpoint</CardTitle>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="outboundLabel">Label</Label>
            <Input
              id="outboundLabel"
              placeholder="e.g. CRM call events"
              value={outboundLabel}
              onChange={(e) => setOutboundLabel(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="outboundUrl">Endpoint URL</Label>
            <Input
              id="outboundUrl"
              placeholder="https://example.com/webhooks/transovo-voice"
              value={outboundUrl}
              onChange={(e) => setOutboundUrl(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Voice events</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {subscriptionOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={outboundEvents.includes(opt.value)}
                    onChange={() => toggleEvent(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          {outboundSecret ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Signing secret (shown once):{" "}
              <span className="font-mono break-all">{outboundSecret}</span>
            </p>
          ) : null}
          <Button
            type="button"
            onClick={createOutboundEndpoint}
            disabled={outboundCreating || !outboundLabel.trim() || !outboundUrl.trim()}
          >
            {outboundCreating ? "Saving…" : "Add endpoint"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Deliveries are signed with HMAC-SHA256 in the{" "}
            <code className="text-xs">X-Transovo-Signature</code> header (timestamp + body).
          </p>
        </div>
      </Card>

      <Card className="mb-4">
        <CardTitle>Incoming webhooks</CardTitle>
        <p className="mb-4 text-sm text-muted-foreground">
          Receive events from another system into Transovo.
        </p>
        {endpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">No incoming automation endpoints yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Incoming URL</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {endpoints.map((endpoint) => (
                <TR key={endpoint.id}>
                  <TD>{endpoint.name}</TD>
                  <TD className="max-w-[280px] truncate font-mono text-sm">{endpoint.incomingUrl}</TD>
                  <TD>
                    <StatusChip status={endpoint.active ? "Active" : "Paused"} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardTitle>Create incoming webhook endpoint</CardTitle>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="webhookName">Endpoint name</Label>
            <Input
              id="webhookName"
              placeholder="e.g. Zapier lead capture"
              value={incomingName}
              onChange={(e) => setIncomingName(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button
            type="button"
            onClick={createIncomingEndpoint}
            disabled={incomingCreating || !incomingName.trim()}
          >
            {incomingCreating ? "Creating…" : "Create incoming endpoint"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Incoming automation webhooks receive POST requests and enroll contacts in campaigns.
          </p>
        </div>
      </Card>
    </>
  );
}
