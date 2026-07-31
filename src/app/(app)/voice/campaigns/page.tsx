"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { Pause, Play, Plus, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";

export default function VoiceCampaignsPage() {
  const [rows, setRows] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);
  const [lists, setLists] = useState<Array<{ id: string; name: string }>>([]);
  const [name, setName] = useState("Lead follow-up");
  const [agentId, setAgentId] = useState("");
  const [enrollCampaignId, setEnrollCampaignId] = useState("");
  const [enrollListId, setEnrollListId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    fetch("/api/voice/campaigns").then((r) => r.json()).then((j) => setRows(j.data || []));
    fetch("/api/voice/agents").then((r) => r.json()).then((j) => {
      setAgents(j.data || []);
      if (j.data?.[0]) setAgentId(j.data[0].id);
    });
    fetch("/api/contacts/lists").then((r) => r.json()).then((j) => {
      setLists(j.data || []);
      if (j.data?.[0]) setEnrollListId(j.data[0].id);
    });
  }

  useEffect(() => { load(); }, []);

  async function create() {
    await fetch("/api/voice/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, agentId }),
    });
    load();
  }

  async function campaignAction(id: string, action: string, extra?: Record<string, unknown>) {
    const res = await fetch(`/api/voice/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });
    const json = await res.json();
    setNotice(json.error || `${action}: ${JSON.stringify(json.data)}`);
    load();
  }

  return (
    <div>
      <PageHeader title="Outbound campaigns" description="Schedule, pace, and monitor AI outbound calling campaigns." />
      <VoiceSubNav />
      {notice && <p className="mb-4 text-sm text-muted-foreground">{notice}</p>}
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

      <Card className="mb-6 space-y-4 p-5">
        <h2 className="font-medium">Enroll audience from list</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Campaign</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              value={enrollCampaignId}
              onChange={(e) => setEnrollCampaignId(e.target.value)}
            >
              <option value="">Select campaign</option>
              {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Contact list</Label>
            <select
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
              value={enrollListId}
              onChange={(e) => setEnrollListId(e.target.value)}
            >
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              disabled={!enrollCampaignId || !enrollListId}
              onClick={() => campaignAction(enrollCampaignId, "enroll", {
                audience: { listId: enrollListId, requireConsent: true, excludeResponders: true },
              })}
            >
              <UserPlus className="h-4 w-4" /> Enroll list
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <THead><TR><TH>Name</TH><TH>Status</TH><TH>Actions</TH></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>{r.name}</TD>
                <TD><StatusChip status={r.status} /></TD>
                <TD className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => campaignAction(r.id, "start")}>
                    <Play className="h-3 w-3" /> Start
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => campaignAction(r.id, "pause")}>
                    <Pause className="h-3 w-3" /> Pause
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      fetch(`/api/voice/campaigns/${r.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          voicemailRules: { action: "sms_followup", smsBody: "Sorry we missed you — reply to connect." },
                        }),
                      }).then(() => load());
                    }}
                  >
                    Voicemail SMS
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
