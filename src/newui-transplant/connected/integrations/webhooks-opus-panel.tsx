"use client";

import { Panel, Pill } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { Checkbox } from "@/newui-transplant/components/ui/checkbox";
import { Input } from "@/newui-transplant/components/ui/input";
import { Label } from "@/newui-transplant/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/newui-transplant/components/ui/table";
import {
  VOICE_WEBHOOK_EVENT_LABELS,
  VOICE_WEBHOOK_SUBSCRIPTION_EVENT_TYPES,
} from "@/lib/voice-v3/webhooks/events";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type IntegrationEndpoint = {
  id: string;
  name: string;
  incomingUrl: string;
  active: boolean;
};

type OutboundWebhook = {
  id: string;
  url: string;
  label?: string;
  events: string[];
  active: boolean;
};

type Props = {
  endpoints: IntegrationEndpoint[];
  outbound: OutboundWebhook[];
};

const subscriptionOptions = VOICE_WEBHOOK_SUBSCRIPTION_EVENT_TYPES.map((value) => ({
  value,
  label: VOICE_WEBHOOK_EVENT_LABELS[value],
}));

export function WebhooksOpusPanel({ endpoints: initialEndpoints, outbound: initialOutbound }: Props) {
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
        active: w.active,
      })),
    [outbound],
  );

  async function refreshIncoming() {
    const res = await fetch("/api/integrations/webhooks");
    if (!res.ok) return;
    const json = await res.json();
    setEndpoints(
      (json.data || []).map(
        (e: { id: string; name: string; incomingUrl: string; active: boolean }) => ({
          id: e.id,
          name: e.name,
          incomingUrl: e.incomingUrl,
          active: e.active,
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
      if (json.data?.signingSecret) setOutboundSecret(json.data.signingSecret);
      await refreshOutbound();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create outbound endpoint");
    } finally {
      setOutboundCreating(false);
    }
  }

  async function toggleOutbound(id: string, active: boolean) {
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
    const res = await fetch("/api/integrations/webhooks/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", webhookId: id }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error || "Test delivery failed to queue");
  }

  async function deleteOutbound(id: string) {
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
    <div className="space-y-6">
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      <Panel title="Outbound webhooks" description="Send Voice events from Transovo to another system.">
        {outboundRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No outbound Voice endpoints yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outboundRows.map((endpoint) => (
                <TableRow key={endpoint.id}>
                  <TableCell className="font-medium">{endpoint.label}</TableCell>
                  <TableCell className="max-w-[200px] truncate font-mono text-xs">{endpoint.url}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{endpoint.events.join(", ")}</TableCell>
                  <TableCell>
                    <Pill tone={endpoint.active ? "success" : "neutral"}>{endpoint.active ? "Active" : "Paused"}</Pill>
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => void testOutbound(endpoint.id)}>Test</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void toggleOutbound(endpoint.id, !endpoint.active)}>
                      {endpoint.active ? "Pause" : "Activate"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void deleteOutbound(endpoint.id)}>Delete</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel title="Add outbound Voice endpoint">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="outboundLabel">Label</Label>
            <Input id="outboundLabel" value={outboundLabel} onChange={(e) => setOutboundLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outboundUrl">Endpoint URL</Label>
            <Input id="outboundUrl" value={outboundUrl} onChange={(e) => setOutboundUrl(e.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {subscriptionOptions.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <Checkbox checked={outboundEvents.includes(opt.value)} onCheckedChange={() => toggleEvent(opt.value)} />
                {opt.label}
              </label>
            ))}
          </div>
          {outboundSecret ? (
            <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              Signing secret (shown once): <span className="font-mono break-all">{outboundSecret}</span>
            </p>
          ) : null}
          <Button type="button" onClick={() => void createOutboundEndpoint()} disabled={outboundCreating || !outboundLabel.trim() || !outboundUrl.trim()}>
            {outboundCreating ? "Saving…" : "Add endpoint"}
          </Button>
        </div>
      </Panel>

      <Panel title="Incoming webhooks" description="Receive events from another system into Transovo.">
        {endpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">No incoming automation endpoints yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Incoming URL</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((endpoint) => (
                <TableRow key={endpoint.id}>
                  <TableCell>{endpoint.name}</TableCell>
                  <TableCell className="max-w-[280px] truncate font-mono text-xs">{endpoint.incomingUrl}</TableCell>
                  <TableCell>
                    <Pill tone={endpoint.active ? "success" : "neutral"}>{endpoint.active ? "Active" : "Paused"}</Pill>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel title="Create incoming webhook endpoint">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="webhookName">Endpoint name</Label>
            <Input id="webhookName" value={incomingName} onChange={(e) => setIncomingName(e.target.value)} />
          </div>
          <Button type="button" onClick={() => void createIncomingEndpoint()} disabled={incomingCreating || !incomingName.trim()}>
            {incomingCreating ? "Creating…" : "Create incoming endpoint"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
