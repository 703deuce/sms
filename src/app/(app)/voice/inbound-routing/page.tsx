"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { Plus, Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type Rule = {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
};

const ACTION_TYPES = ["ai_answer", "transfer", "voicemail", "hangup"];

export default function InboundRoutingPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState("Business hours AI");
  const [actionType, setActionType] = useState("ai_answer");
  const [businessHoursOnly, setBusinessHoursOnly] = useState(true);
  const [simFrom, setSimFrom] = useState("+14155550100");
  const [simTo, setSimTo] = useState("+14155550200");
  const [simResult, setSimResult] = useState<string | null>(null);

  function load() {
    fetch("/api/voice/routing").then((r) => r.json()).then((j) => setRules(j.data || []));
    fetch("/api/voice/agents").then((r) => r.json()).then((j) => setAgents(j.data || []));
  }

  useEffect(() => { load(); }, []);

  async function addRule() {
    await fetch("/api/voice/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        priority: rules.length,
        conditions: { businessHoursOnly, startHour: 9, endHour: 17 },
        actions: { type: actionType, agentId: agents[0]?.id },
      }),
    });
    load();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/voice/routing/${id}`, { method: "DELETE" });
    load();
  }

  async function simulate() {
    const res = await fetch("/api/voice/routing/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromE164: simFrom, toE164: simTo }),
    });
    const json = await res.json();
    setSimResult(JSON.stringify(json.data, null, 2));
  }

  return (
    <div>
      <PageHeader
        title="Inbound routing"
        description="Visual routing editor for business hours, overflow, VIP, and AI handoff rules."
      />
      <VoiceSubNav />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-5">
          <h2 className="font-medium">Add routing rule</h2>
          <div>
            <Label>Rule name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Action</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
            >
              {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={businessHoursOnly} onChange={(e) => setBusinessHoursOnly(e.target.checked)} />
            Business hours only (9–17)
          </label>
          <Button onClick={addRule}><Plus className="h-4 w-4" /> Add rule</Button>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="font-medium">Simulate routing</h2>
          <div>
            <Label>Caller (from)</Label>
            <Input value={simFrom} onChange={(e) => setSimFrom(e.target.value)} />
          </div>
          <div>
            <Label>Your number (to)</Label>
            <Input value={simTo} onChange={(e) => setSimTo(e.target.value)} />
          </div>
          <Button variant="outline" onClick={simulate}><Play className="h-4 w-4" /> Run simulation</Button>
          {simResult && (
            <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">{simResult}</pre>
          )}
        </Card>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-3 font-medium">Active rules (priority order)</div>
        <Table>
          <THead>
            <TR>
              <TH>Priority</TH>
              <TH>Name</TH>
              <TH>Conditions</TH>
              <TH>Action</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rules.map((r) => (
              <TR key={r.id}>
                <TD>{r.priority}</TD>
                <TD>{r.name}</TD>
                <TD className="text-xs font-mono">{JSON.stringify(r.conditions)}</TD>
                <TD className="text-xs font-mono">{JSON.stringify(r.actions)}</TD>
                <TD>
                  <Button size="sm" variant="ghost" onClick={() => deleteRule(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TD>
              </TR>
            ))}
            {!rules.length && (
              <TR><TD colSpan={5} className="text-muted-foreground">No rules yet — default AI answer applies.</TD></TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
