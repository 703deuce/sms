"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { MicTestPanel } from "@/components/voice/mic-test-panel";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function VoiceTestingPage() {
  const [agents, setAgents] = useState<Array<{ id: string; name: string; rawStatus?: string }>>([]);
  const [contacts, setContacts] = useState<Array<{ id: string; phone: string; firstName?: string; lastName?: string }>>([]);
  const [tools, setTools] = useState<Array<{ id: string; name: string }>>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{ id: string; name: string }>>([]);
  const [agentId, setAgentId] = useState("");
  const [contactId, setContactId] = useState("");
  const [testNumber, setTestNumber] = useState("+14155550199");
  const [kbId, setKbId] = useState("");
  const [kbQuery, setKbQuery] = useState("hours");
  const [toolId, setToolId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [trace, setTrace] = useState<string>("");
  const [lastCallId, setLastCallId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/voice/agents")
      .then((r) => r.json())
      .then((j) => {
        setAgents(j.data || []);
        if (j.data?.[0]) setAgentId(j.data[0].id);
      });
    fetch("/api/contacts?q=")
      .then((r) => r.json())
      .then((j) => setContacts((j.data || []).slice(0, 50)));
    fetch("/api/voice/tools")
      .then((r) => r.json())
      .then((j) => {
        setTools(j.data || []);
        if (j.data?.[0]) setToolId(j.data[0].id);
      });
    fetch("/api/voice/knowledge")
      .then((r) => r.json())
      .then((j) => {
        setKnowledgeBases(j.data || []);
        if (j.data?.[0]) setKbId(j.data[0].id);
      });
  }, []);

  useEffect(() => {
    const c = contacts.find((x) => x.id === contactId);
    if (c?.phone) setTestNumber(c.phone);
  }, [contactId, contacts]);

  async function runTest() {
    setRunning(true);
    setResult(null);
    setTrace("");
    try {
      const res = await fetch(`/api/voice/agents/${agentId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testNumber,
          direction: "outbound",
          contactId: contactId || undefined,
          allowDraft: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const callId = json.data.callId;
      setResult(`Test call initiated: ${callId}. Mode: ${json.data.mode || "unknown"}`);
      setLastCallId(callId);
      setTrace(JSON.stringify(json.data, null, 2));
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Test failed");
    } finally {
      setRunning(false);
    }
  }

  async function testKnowledge() {
    if (!kbId) return;
    const res = await fetch(`/api/voice/knowledge/${kbId}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: kbQuery }),
    });
    const json = await res.json();
    setTrace(JSON.stringify(json.data || json, null, 2));
    setResult(res.ok ? `Knowledge hits: ${(json.data || []).length}` : json.error);
  }

  async function testTool() {
    if (!toolId) return;
    const res = await fetch(`/api/voice/tools/${toolId}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { phone: testNumber, body: "Test from voice lab" } }),
    });
    const json = await res.json();
    setTrace(JSON.stringify(json, null, 2));
    setResult(res.ok ? "Tool test completed" : json.error || "Tool test failed");
  }

  async function testBooking() {
    const res = await fetch("/api/voice/calendars/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daysAhead: 3 }),
    });
    const json = await res.json();
    setTrace(JSON.stringify(json, null, 2));
    setResult(res.ok ? `Availability slots: ${(json.data?.slots || json.slots || []).length}` : json.error);
  }

  return (
    <div>
      <PageHeader
        title="Testing lab"
        description="Test drafts, knowledge, tools, booking, and real/mock outbound calls before launch."
      />
      <VoiceSubNav />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h2 className="font-medium">Outbound test call</h2>
          <p className="text-xs text-muted-foreground">
            Works in mock mode without a number. With Telnyx + a number, places a real test call
            (including unpublished drafts when the agent has been synced).
          </p>
          <div>
            <Label>Agent (includes drafts)</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.rawStatus ? ` (${a.rawStatus})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Test contact (optional)</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              <option value="">Manual number</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone} · {c.phone}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Test number (E.164)</Label>
            <Input value={testNumber} onChange={(e) => setTestNumber(e.target.value)} />
          </div>
          <Button disabled={running || !agentId} onClick={runTest}>
            {running ? "Running…" : "Place outbound test call"}
          </Button>
          {lastCallId ? (
            <Link className="text-sm text-primary underline" href={`/voice/calls/${lastCallId}`}>
              Open call detail / live transcript
            </Link>
          ) : null}
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-medium">Component tests</h2>
          <div>
            <Label>Knowledge base</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              value={kbId}
              onChange={(e) => setKbId(e.target.value)}
            >
              {knowledgeBases.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            <Input className="mt-2" value={kbQuery} onChange={(e) => setKbQuery(e.target.value)} />
            <Button className="mt-2" variant="outline" onClick={testKnowledge}>
              Test knowledge search
            </Button>
          </div>
          <div>
            <Label>Tool</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
            >
              {tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button className="mt-2" variant="outline" onClick={testTool}>
              Test tool (with trace)
            </Button>
          </div>
          <Button variant="outline" onClick={testBooking}>
            Test booking availability
          </Button>
          <MicTestPanel />
        </Card>

        <Card className="space-y-3 p-5 lg:col-span-2">
          <h2 className="font-medium">Result / tool-call trace</h2>
          {result ? <p className="text-sm">{result}</p> : null}
          <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 text-xs">
            {trace || "Run a test to see latency/cost/tool output here."}
          </pre>
        </Card>
      </div>
    </div>
  );
}
