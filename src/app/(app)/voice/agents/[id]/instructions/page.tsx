"use client";

import { Input, Label, Textarea } from "@/components/ui/input";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function AgentInstructionsPage() {
  const params = useParams();
  const agentId = params?.id as string;
  const [role, setRole] = useState("");
  const [system, setSystem] = useState("");
  const [goals, setGoals] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/voice/agents/${agentId}`)
      .then((r) => r.json())
      .then((j) => {
        const cfg = parseVoiceAgentConfig(j.data?.draftConfig);
        setRole(cfg.instructions?.role || "");
        setSystem(cfg.instructions?.system || "");
        setGoals(cfg.instructions?.goals || "");
      })
      .catch(() => undefined);
  }, [agentId]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/voice/agents/${agentId}`);
      const j = await res.json();
      const cfg = parseVoiceAgentConfig(j.data?.draftConfig);
      await fetch(`/api/voice/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftConfig: {
            ...cfg,
            instructions: { ...cfg.instructions, role, system, goals },
          },
        }),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Instructions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell Amy how to behave on calls — in plain language, not developer prompts.
        </p>
      </div>
      <div className="voice-card space-y-4 p-6">
        <div>
          <Label>Role</Label>
          <Input className="mt-1.5" value={role} onChange={(e) => setRole(e.target.value)} />
        </div>
        <div>
          <Label>What does your business do?</Label>
          <Textarea
            className="mt-1.5 min-h-[100px]"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
          />
        </div>
        <div>
          <Label>Goals & capabilities</Label>
          <Textarea
            className="mt-1.5 min-h-[120px]"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
          />
        </div>
        <button type="button" disabled={busy} onClick={save} className="voice-btn-primary">
          {busy ? "Saving…" : "Save instructions"}
        </button>
      </div>
    </div>
  );
}
