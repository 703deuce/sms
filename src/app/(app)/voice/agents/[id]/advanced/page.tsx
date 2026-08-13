"use client";

import { AgentAdvancedSettings } from "@/components/receptionist/agent-advanced-settings";
import { ReceptionistEditorShell } from "@/components/receptionist/receptionist-editor-shell";
import { useReceptionistAgentState } from "@/components/receptionist/use-receptionist-agent-state";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AgentAdvancedPage() {
  const params = useParams();
  const agentId = params?.id as string;
  const {
    state,
    advanced,
    agentName,
    loading,
    busy,
    error,
    setError,
    patchAdvanced,
    discardAdvanced,
    save,
  } = useReceptionistAgentState(agentId);

  if (loading || !state || !advanced) {
    return (
      <ReceptionistEditorShell agentId={agentId}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </ReceptionistEditorShell>
    );
  }

  async function handleSave() {
    try {
      await save();
    } catch {
      // error in hook
    }
  }

  return (
    <ReceptionistEditorShell
      agentId={agentId}
      agentTitle={state.agentName || agentName}
      onSave={handleSave}
      saveBusy={busy}
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
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
      <AgentAdvancedSettings
        value={advanced}
        onChange={patchAdvanced}
        capabilities={state.capabilities}
        agentId={agentId}
        agentDisplayName={state.agentName || "Amy"}
        onSave={handleSave}
        onDiscard={discardAdvanced}
        busy={busy}
      />
    </ReceptionistEditorShell>
  );
}
