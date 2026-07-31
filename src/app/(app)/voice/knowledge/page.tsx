"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

export default function VoiceKnowledgePage() {
  const [rows, setRows] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [name, setName] = useState("Business FAQ");

  function load() {
    fetch("/api/voice/knowledge")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []));
  }

  useEffect(() => { load(); }, []);

  async function create() {
    await fetch("/api/voice/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    load();
  }

  return (
    <div>
      <PageHeader title="Knowledge bases" description="Documents, FAQs, and structured facts for agent retrieval." />
      <VoiceSubNav />
      <Card className="mb-6 flex flex-wrap items-end gap-3 p-5">
        <div className="flex-1">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <Button onClick={create}><Plus className="h-4 w-4" /> Create</Button>
      </Card>
      <Card className="overflow-hidden p-0">
        <Table>
          <THead><TR><TH>Name</TH><TH>Status</TH></TR></THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id}><TD>{r.name}</TD><TD>{r.status}</TD></TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
