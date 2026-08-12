"use client";

import { AgentEditorNav } from "@/components/receptionist/agent-editor-nav";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type AgentHeader = {
  name: string;
  status: string;
  displayName?: string | null;
};

export default function VoiceAgentLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const agentId = params?.id as string;
  const [agent, setAgent] = useState<AgentHeader | null>(null);

  useEffect(() => {
    if (!agentId) return;
    fetch(`/api/voice/agents/${agentId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setAgent({
            name: j.data.name,
            status: j.data.status,
            displayName: j.data.displayName,
          });
        }
      })
      .catch(() => undefined);
  }, [agentId]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link
          href="/voice/agents"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to Agents
        </Link>
        <button type="button" className="voice-btn-primary text-sm">
          Save Changes
        </button>
      </div>

      {agent ? (
        <div className="mb-4">
          <h1 className="font-display text-xl font-semibold tracking-tight">
            {agent.displayName || agent.name}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{agent.status}</p>
        </div>
      ) : null}

      <AgentEditorNav agentId={agentId} />
      {children}
    </div>
  );
}
