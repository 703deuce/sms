"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import { VOICE_FLOW_TEMPLATES } from "@/lib/voice/flow/templates";
import { VOICE_AGENT_TEMPLATES } from "@/lib/voice/templates";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

const LEVELS = [
  {
    id: "answering",
    name: "AI Answering",
    description: "Missed-call / after-hours alternative to voicemail.",
  },
  {
    id: "intake",
    name: "AI Intake",
    description: "Lead questions, CRM save, booking links, urgency routing.",
  },
  {
    id: "receptionist",
    name: "AI Receptionist",
    description: "Main line, departments, transfers, CRM, handoffs.",
  },
  {
    id: "pro",
    name: "AI Agent Pro",
    description: "Multi-assistant, advanced tools, custom workflows.",
  },
] as const;

export default function VoiceAgentNewPage() {
  const router = useRouter();
  const [name, setName] = useState("Front Desk");
  const [level, setLevel] = useState<(typeof LEVELS)[number]["id"]>("receptionist");
  const [flowTemplateId, setFlowTemplateId] = useState("full_receptionist");
  const [agentTemplateId, setAgentTemplateId] = useState("receptionist");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const flowOptions = VOICE_FLOW_TEMPLATES.filter(
    (t) => t.agentLevel === level || (level === "pro" && t.agentLevel === "receptionist"),
  );

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/voice/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "New voice agent",
          agentType: agentTemplateId || "receptionist",
          templateId: agentTemplateId || "receptionist",
          description: `Level: ${level}; flow: ${flowTemplateId}`,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      const agentId = json.data.id as string;

      // Attach chosen visual flow template.
      await fetch(`/api/voice/agents/${agentId}/flows`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: flowTemplateId, apply: true }),
      });

      router.replace(`/voice/agents/${agentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Create AI voice agent"
        description="Pick a product level and a template-driven call flow. Edit the canvas after creation."
      />
      <VoiceSubNav />

      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="space-y-3 p-5">
          <CardTitle>1. Agent name</CardTitle>
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <CardTitle>2. Product level</CardTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setLevel(l.id);
                  const first = VOICE_FLOW_TEMPLATES.find((t) => t.agentLevel === l.id);
                  if (first) setFlowTemplateId(first.id);
                  if (l.id === "intake") setAgentTemplateId("lead_qualification");
                  else if (l.id === "answering") setAgentTemplateId("receptionist");
                  else setAgentTemplateId("receptionist");
                }}
                className={cn(
                  "rounded-lg border px-3 py-3 text-left",
                  level === l.id ? "border-foreground bg-muted/40" : "border-border",
                )}
              >
                <p className="text-sm font-semibold">{l.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{l.description}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <CardTitle>3. Flow template</CardTitle>
          <div className="space-y-2">
            {(flowOptions.length ? flowOptions : VOICE_FLOW_TEMPLATES).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFlowTemplateId(t.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-3 text-left",
                  flowTemplateId === t.id
                    ? "border-foreground bg-muted/40"
                    : "border-border",
                )}
              >
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <CardTitle>4. Agent instruction template</CardTitle>
          <select
            className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
            value={agentTemplateId}
            onChange={(e) => setAgentTemplateId(e.target.value)}
          >
            {VOICE_AGENT_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Card>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <div className="flex gap-2">
          <Button disabled={busy} onClick={create}>
            {busy ? "Creating…" : "Create agent"}
          </Button>
          <Button variant="outline" onClick={() => router.push("/voice/agents")}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
