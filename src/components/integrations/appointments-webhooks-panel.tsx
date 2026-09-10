"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

type WebhookEndpoint = {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
};

type WebhookDelivery = {
  id: string;
  eventType: string;
  status: string;
  attemptCount?: number;
  lastError?: string | null;
  createdAt: string;
  deliveredAt?: string | null;
  endpoint?: { url: string };
};

const DEFAULT_EVENTS = "appointment.created,appointment.canceled,appointment.rescheduled";

export function AppointmentsWebhooksPanel() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [url, setUrl] = useState("https://");
  const [events, setEvents] = useState(DEFAULT_EVENTS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [epRes, delRes] = await Promise.all([
        fetch("/api/appointments/service-booking/webhooks"),
        fetch("/api/appointments/service-booking/webhooks/deliveries"),
      ]);
      if (epRes.ok) {
        const json = await epRes.json();
        setEndpoints((json.data || json) as WebhookEndpoint[]);
      }
      if (delRes.ok) {
        const json = await delRes.json();
        setDeliveries((json.data || json) as WebhookDelivery[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!url.trim()) return;
    setSaving(true);
    setMessage(null);
    setNewSecret(null);
    const res = await fetch("/api/appointments/service-booking/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: url.trim(),
        events: events.split(",").map((e) => e.trim()).filter(Boolean),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(json.error || "Create failed");
      return;
    }
    const secret = json.data?.signingSecret as string | undefined;
    if (secret) setNewSecret(secret);
    setMessage("Webhook endpoint created.");
    await load();
  }

  function copySecret() {
    if (!newSecret) return;
    navigator.clipboard?.writeText(newSecret).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card p-5 space-y-4" aria-labelledby="webhook-endpoints-title">
        <div>
          <h2 id="webhook-endpoints-title" className="text-sm font-semibold text-foreground">
            Outbound webhooks
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Receive appointment events at your server. Payloads are signed with HMAC-SHA256 using your endpoint secret.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span>Endpoint URL</span>
          <input
            className="rounded-md border px-3 py-2"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/transovo"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Events (comma-separated)</span>
          <input
            className="rounded-md border px-3 py-2 font-mono text-xs"
            value={events}
            onChange={(e) => setEvents(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          disabled={saving}
          onClick={() => void create()}
        >
          {saving ? "Saving…" : "Add webhook"}
        </button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {newSecret ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-900">Signing secret (copy now — shown once)</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs">{newSecret}</code>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                onClick={copySecret}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                Copy
              </button>
            </div>
          </div>
        ) : null}

        <ul className="divide-y rounded-lg border">
          {loading ? (
            <li className="p-4 text-sm text-muted-foreground">Loading…</li>
          ) : endpoints.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">No webhooks yet.</li>
          ) : (
            endpoints.map((row) => (
              <li key={row.id} className="p-4 text-sm">
                <div className="font-medium break-all">{row.url}</div>
                <div className="text-muted-foreground">{row.events?.join(", ")}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {row.active ? "Active" : "Disabled"} · HMAC signing enabled
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl border bg-card p-5 space-y-3" aria-labelledby="webhook-deliveries-title">
        <div>
          <h2 id="webhook-deliveries-title" className="text-sm font-semibold text-foreground">
            Delivery log
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Recent delivery attempts for appointment webhooks.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium" scope="col">Event</th>
                <th className="px-3 py-2 font-medium" scope="col">Endpoint</th>
                <th className="px-3 py-2 font-medium" scope="col">Status</th>
                <th className="px-3 py-2 font-medium" scope="col">When</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                    No deliveries yet.
                  </td>
                </tr>
              ) : (
                deliveries.map((d) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{d.eventType}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate text-xs">{d.endpoint?.url || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="capitalize">{d.status}</span>
                      {d.lastError ? (
                        <span className="block text-xs text-destructive truncate max-w-[180px]" title={d.lastError}>
                          {d.lastError}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
