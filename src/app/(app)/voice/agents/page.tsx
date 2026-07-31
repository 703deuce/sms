"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { VOICE_AGENT_TEMPLATES } from "@/lib/voice/templates";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type AgentRow = {
  id: string;
  name: string;
  agentType: string;
  status: string;
  callsHandled: number;
  healthStatus: string;
  updatedAt: string;
};

export default function VoiceAgentsPage() {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/voice/agents")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .catch(() => undefined);
  }, []);

  async function createFromTemplate(templateId: string, name: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/voice/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, templateId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      window.location.href = `/voice/agents/${json.data.id}`;
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Voice agents"
        description="Create, test, publish, and monitor AI voice agents for inbound and outbound calling."
        actions={
          <Link href="/voice/agents/new">
            <Button><Plus className="h-4 w-4" /> New agent</Button>
          </Link>
        }
      />
      <VoiceSubNav />

      <Card className="mb-6 p-5">
        <p className="mb-3 text-sm font-medium">Starter templates</p>
        <div className="flex flex-wrap gap-2">
          {VOICE_AGENT_TEMPLATES.map((t) => (
            <Button
              key={t.id}
              variant="outline"
              size="sm"
              disabled={creating}
              onClick={() => createFromTemplate(t.id, t.name)}
            >
              {t.name}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>Status</TH>
              <TH>Calls</TH>
              <TH>Health</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map((a) => (
              <TR key={a.id}>
                <TD className="font-medium">
                  <Link href={`/voice/agents/${a.id}`} className="hover:text-primary">
                    {a.name}
                  </Link>
                </TD>
                <TD>{a.agentType}</TD>
                <TD><StatusChip status={a.status} /></TD>
                <TD>{a.callsHandled}</TD>
                <TD>{a.healthStatus}</TD>
                <TD>
                  <Link href={`/voice/agents/${a.id}`} className="text-sm text-primary">Edit</Link>
                </TD>
              </TR>
            ))}
            {!rows.length && (
              <TR><TD colSpan={6} className="text-muted-foreground">No agents yet.</TD></TR>
            )}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
