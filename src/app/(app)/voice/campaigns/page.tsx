"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export default function VoiceCampaignsPage() {
  const [rows, setRows] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState("Lead follow-up");
  const [agentId, setAgentId] = useState("");

  useEffect(() => {
    fetch("/api/voice/campaigns").then((r) => r.json()).then((j) => setRows(j.data || []));
    fetch("/api/voice/agents").then((r) => r.json()).then((j) => {
      setAgents(j.data || []);
      if (j.data?.[0]) setAgentId(j.data[0].id);
    });
  }, []);

  async function create() {
    await fetch("/api/voice/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, agentId }),
    });
    const res = await fetch("/api/voice/campaigns");
    const json = await res.json();
    setRows(json.data || []);
  }

  return (
    <div>
      <PageHeader title="Outbound campaigns" description="Schedule, pace, and monitor AI outbound calling campaigns." />
      <VoiceSubNav />
      <Card className="mb-6 grid gap-3 p-5 sm:grid-cols-3">
        <div><Label>Campaign name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>Agent</Label>
          <select className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex items-end"><Button onClick={create}><Plus className="h-4 w-4" /> Create campaign</Button></div>
      </Card>
      <Card className="overflow-hidden p-0">
        <Table>
          <THead><TR><TH>Name</TH><TH>Status</TH></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}><TD>{r.name}</TD><TD><StatusChip status={r.status} /></TD></TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
