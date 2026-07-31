"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";

const TOOL_TYPES = ["webhook", "send_sms", "transfer_call", "book_appointment", "start_automation"];

export default function VoiceToolsPage() {
  const [rows, setRows] = useState<Array<{ id: string; name: string; toolType: string }>>([]);
  const [name, setName] = useState("Send SMS");
  const [toolType, setToolType] = useState("send_sms");
  const [testResult, setTestResult] = useState<string | null>(null);

  function load() {
    fetch("/api/voice/tools").then((r) => r.json()).then((j) => setRows(j.data || []));
  }

  useEffect(() => { load(); }, []);

  async function create() {
    await fetch("/api/voice/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, toolType, config: {} }),
    });
    load();
  }

  async function testTool(id: string) {
    setTestResult(null);
    const res = await fetch(`/api/voice/tools/${id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { phone: "+14155550199", message: "Test from tools UI" } }),
    });
    const json = await res.json();
    setTestResult(JSON.stringify(json.data || json.error, null, 2));
  }

  return (
    <div>
      <PageHeader title="Tools & integrations" description="Reusable tools assigned to multiple agents." />
      <VoiceSubNav />
      <Card className="mb-6 grid gap-3 p-5 sm:grid-cols-3">
        <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div>
          <Label>Type</Label>
          <select className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm" value={toolType} onChange={(e) => setToolType(e.target.value)}>
            {TOOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-end"><Button onClick={create}><Plus className="h-4 w-4" /> Add tool</Button></div>
      </Card>
      {testResult && (
        <pre className="mb-4 rounded bg-muted p-3 text-xs">{testResult}</pre>
      )}
      <Card className="overflow-hidden p-0">
        <Table>
          <THead><TR><TH>Name</TH><TH>Type</TH><TH /></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}>
                <TD>{r.name}</TD>
                <TD>{r.toolType}</TD>
                <TD>
                  <Button size="sm" variant="outline" onClick={() => testTool(r.id)}>
                    <Play className="h-3 w-3" /> Test
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
