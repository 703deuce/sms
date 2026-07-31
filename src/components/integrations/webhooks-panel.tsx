"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Webhook } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  events: string[];
  active: boolean;
};

type Props = {
  endpoints: IntegrationEndpoint[];
  outbound: OutboundWebhook[];
};

export function WebhooksPanel({ endpoints: initialEndpoints, outbound }: Props) {
  const router = useRouter();
  const [endpoints, setEndpoints] = useState(initialEndpoints);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const res = await fetch("/api/integrations/webhooks");
    if (!res.ok) return;
    const json = await res.json();
    setEndpoints(
      (json.data || []).map((e: { id: string; name: string; incomingUrl: string; active: boolean; createdAt: string }) => ({
        id: e.id,
        name: e.name,
        incomingUrl: e.incomingUrl,
        active: e.active,
        createdAt: e.createdAt,
        lastEventAt: null,
        successRate: null,
      })),
    );
  }

  async function createEndpoint() {
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/integrations/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create endpoint");
      setName("");
      await refresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create endpoint");
    } finally {
      setCreating(false);
    }
  }

  const rows = [
    ...endpoints.map((e) => ({
      id: e.id,
      url: e.incomingUrl,
      label: e.name,
      events: ["incoming.automation"],
      status: e.active ? "Active" as const : "Paused" as const,
      lastDelivery: e.lastEventAt || e.createdAt,
      successRate: e.successRate,
      kind: "integration" as const,
    })),
    ...outbound.map((w) => ({
      id: w.id,
      url: w.url,
      label: "Outbound",
      events: w.events,
      status: w.active ? "Active" as const : "Paused" as const,
      lastDelivery: null,
      successRate: null,
      kind: "outbound" as const,
    })),
  ];

  return (
    <>
      <Card className="mb-4">
        <div className="mb-4 flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" />
          <CardTitle>Webhook endpoints</CardTitle>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No webhook endpoints yet.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Endpoint URL</TH>
                <TH>Events</TH>
                <TH>Status</TH>
                <TH>Last delivery</TH>
                <TH>Success rate</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {rows.map((endpoint) => (
                <TR key={endpoint.id}>
                  <TD className="max-w-[240px] truncate font-mono text-sm">
                    {endpoint.url}
                    {endpoint.label !== "Outbound" ? (
                      <span className="ml-2 text-xs text-muted-foreground">({endpoint.label})</span>
                    ) : null}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {endpoint.events.map((event) => (
                        <span
                          key={event}
                          className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          {event}
                        </span>
                      ))}
                    </div>
                  </TD>
                  <TD>
                    <StatusChip status={endpoint.status} />
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {endpoint.lastDelivery
                      ? new Date(endpoint.lastDelivery).toLocaleString()
                      : "—"}
                  </TD>
                  <TD>
                    {endpoint.successRate != null ? `${endpoint.successRate}%` : "—"}
                  </TD>
                  <TD className="text-right">
                    {endpoint.kind === "integration" ? (
                      <Button variant="ghost" size="sm" disabled>
                        Edit
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardTitle>Create webhook endpoint</CardTitle>
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="webhookName">Endpoint name</Label>
            <Input
              id="webhookName"
              placeholder="e.g. Zapier lead capture"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="button" onClick={createEndpoint} disabled={creating || !name.trim()}>
            {creating ? "Creating…" : "Create endpoint"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Incoming automation webhooks receive POST requests and enroll contacts in campaigns.
          </p>
        </div>
      </Card>
    </>
  );
}
