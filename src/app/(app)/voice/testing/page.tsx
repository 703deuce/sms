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
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [agentId, setAgentId] = useState("");
  const [testNumber, setTestNumber] = useState("+14155550199");
  const [result, setResult] = useState<string | null>(null);
  const [lastCallId, setLastCallId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/voice/agents")
      .then((r) => r.json())
      .then((j) => {
        setAgents(j.data || []);
        if (j.data?.[0]) setAgentId(j.data[0].id);
      });
  }, []);

  async function runTest() {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`/api/voice/agents/${agentId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testNumber, direction: "outbound" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      const callId = json.data.callId;
      setResult(
        `Test call completed (mock): ${callId}. View it under Calls.`,
      );
      setLastCallId(callId);
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Test failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <PageHeader title="Testing lab" description="Place test calls separated from production analytics." />
      <VoiceSubNav />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h2 className="font-medium">Outbound test call</h2>
          <p className="text-xs text-muted-foreground">
            Without Telnyx configured, test calls run in mock mode and appear under Calls.
            Assign a workspace phone number for caller ID.
          </p>
          <div>
            <Label>Agent</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
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
          {result && (
            <p className="text-sm">
              {result}
              {lastCallId && (
                <>
                  {" "}
                  <Link href={`/voice/calls/${lastCallId}`} className="text-primary underline">
                    Open call detail
                  </Link>
                </>
              )}
            </p>
          )}
        </Card>
        <MicTestPanel />
      </div>
    </div>
  );
}
