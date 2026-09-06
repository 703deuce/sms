"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

type Channel = "sms" | "email";

export function AiBookingAdminClient() {
  const [channel, setChannel] = useState<Channel>("email");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [contactId, setContactId] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  async function send() {
    if (!message.trim()) return;
    setLoading(true);
    setError("");
    const userLine = message.trim();
    setHistory((h) => [...h, { role: "user", content: userLine }]);
    setMessage("");
    try {
      const res = await fetch("/api/appointments/ai-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          message: userLine,
          phone: phone || undefined,
          email: email || undefined,
          contactId: contactId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      const reply = String(json.data?.message || json.data?.type || "No response");
      setHistory((h) => [...h, { role: "assistant", content: reply }]);
      setLastResult(json.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-6 py-6 lg:px-8 max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">AI booking console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Test the unified booking orchestrator for SMS and email. Outbound voice uses Telnyx press-1 reminders.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <CardTitle className="text-base">Channel & identity</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Channel</Label>
            <select
              className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          <div>
            <Label>Contact ID (optional)</Label>
            <Input className="mt-1.5" value={contactId} onChange={(e) => setContactId(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input className="mt-1.5" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input className="mt-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <CardTitle className="text-base">Conversation</CardTitle>
        {history.length > 0 ? (
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-muted/40 p-3">
            {history.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-[13px] whitespace-pre-wrap ${
                  m.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-8 border bg-card"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Send a booking request to start.</p>
        )}
        <Textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. I'd like to book a cleaning next Tuesday afternoon"
        />
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <Button onClick={send} disabled={loading || !message.trim()}>
          {loading ? "Processing…" : "Send to orchestrator"}
        </Button>
      </Card>

      {lastResult ? (
        <Card className="p-5">
          <CardTitle className="text-base mb-3">Last result payload</CardTitle>
          <pre className="max-h-64 overflow-auto rounded-lg bg-muted/40 p-3 text-[11px]">
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </Card>
      ) : null}
    </div>
  );
}
