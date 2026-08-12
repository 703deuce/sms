"use client";

import { CAPABILITY_OPTIONS } from "@/lib/receptionist-wizard/types";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SelectableCard } from "@/components/receptionist/ui";

export default function AgentActionsPage() {
  const params = useParams();
  const agentId = params?.id as string;
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/voice/agents/${agentId}`)
      .then((r) => r.json())
      .then((j) => {
        const cfg = parseVoiceAgentConfig(j.data?.draftConfig);
        const wiz = (cfg.advanced as { receptionistWizard?: { capabilities?: string[] } })
          ?.receptionistWizard;
        if (wiz?.capabilities) setEnabled(new Set(wiz.capabilities));
      })
      .catch(() => undefined);
  }, [agentId]);

  async function toggle(id: string) {
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEnabled(next);
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
            advanced: {
              ...cfg.advanced,
              receptionistWizard: {
                ...(cfg.advanced as object),
                capabilities: [...next],
              },
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
        <h2 className="text-lg font-semibold">Actions & permissions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose exactly what Amy is allowed to do on calls.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITY_OPTIONS.map((cap) => (
          <SelectableCard
            key={cap.id}
            selected={enabled.has(cap.id)}
            onClick={() => !busy && toggle(cap.id)}
            title={cap.label}
            description={cap.description}
            compact
          />
        ))}
      </div>
    </div>
  );
}
