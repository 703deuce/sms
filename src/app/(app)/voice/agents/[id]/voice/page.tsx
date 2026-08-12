"use client";

import { WIZARD_VOICES } from "@/lib/receptionist-wizard/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/input";

export default function AgentVoicePage() {
  const params = useParams();
  const agentId = params?.id as string;
  const [voiceId, setVoiceId] = useState("");
  const [greeting, setGreeting] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/voice/agents/${agentId}`)
      .then((r) => r.json())
      .then((j) => {
        const cfg = parseVoiceAgentConfig(j.data?.draftConfig);
        setVoiceId(cfg.voiceLanguage?.voiceId || "ava-warm-us");
        const gh = cfg.callHandling as { startupGreeting?: { text?: string } } | undefined;
        setGreeting(gh?.startupGreeting?.text || "");
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
            voiceLanguage: { ...cfg.voiceLanguage, voiceId },
            callHandling: {
              ...cfg.callHandling,
              startupGreeting: { enabled: true, text: greeting },
            },
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
        <h2 className="text-lg font-semibold">Voice & call handling</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          How Amy sounds and greets callers.
        </p>
      </div>

      <div className="voice-card p-6 space-y-4">
        <Label>Voice</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {WIZARD_VOICES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVoiceId(v.id)}
              className={cn(
                "rounded-xl border p-3 text-left text-sm transition",
                voiceId === v.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30",
              )}
            >
              <span className="font-semibold">{v.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{v.description}</span>
            </button>
          ))}
        </div>

        <div>
          <Label>Opening greeting</Label>
          <Textarea
            className="mt-1.5"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
          />
        </div>

        <button type="button" disabled={busy} onClick={save} className="voice-btn-primary">
          {busy ? "Saving…" : "Save voice settings"}
        </button>
      </div>
    </div>
  );
}
