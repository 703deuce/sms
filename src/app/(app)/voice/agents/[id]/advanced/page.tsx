"use client";

import { AgentAdvancedSettings } from "@/components/receptionist/agent-advanced-settings";
import { ReceptionistEditorShell } from "@/components/receptionist/receptionist-editor-shell";
import { useReceptionistAgentState } from "@/components/receptionist/use-receptionist-agent-state";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AgentAdvancedPage() {
  const params = useParams();
  const agentId = params?.id as string;
  const { state, agentName, loading, busy, save } = useReceptionistAgentState(agentId);

  if (loading || !state) {
    return (
      <ReceptionistEditorShell agentId={agentId}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </ReceptionistEditorShell>
    );
  }

  return (
    <ReceptionistEditorShell
      agentId={agentId}
      agentTitle={state.agentName || agentName}
      onSave={() => save()}
      saveBusy={busy}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link
          href={`/voice/agents/${agentId}/capabilities`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to capabilities
        </Link>
        <Link
          href={`/voice/agents/${agentId}/voice-test`}
          className="text-sm font-medium text-primary hover:underline"
        >
          Continue to Voice & Test →
        </Link>
      </div>
      <AgentAdvancedSettings />
    </ReceptionistEditorShell>
  );
}
