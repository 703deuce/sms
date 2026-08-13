"use client";

import { ReceptionistEditorShell } from "@/components/receptionist/receptionist-editor-shell";
import { VoiceTestStep } from "@/components/receptionist/steps/voice-test-step";
import { useReceptionistAgentState } from "@/components/receptionist/use-receptionist-agent-state";
import { useParams, useRouter } from "next/navigation";

export default function AgentVoiceTestPage() {
  const params = useParams();
  const agentId = params?.id as string;
  const router = useRouter();
  const { state, agentName, loading, busy, error, setError, patch, save, publish, buildForTest } =
    useReceptionistAgentState(agentId);

  if (loading || !state) {
    return (
      <ReceptionistEditorShell agentId={agentId}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </ReceptionistEditorShell>
    );
  }

  const stateWithId = { ...state, agentId };

  async function activate() {
    try {
      await save();
      await buildForTest();
      try {
        await publish();
      } catch {
        setError("Saved — publish when you're ready from this page.");
      }
    } catch {
      // error in hook
    }
  }

  return (
    <ReceptionistEditorShell
      agentId={agentId}
      agentTitle={state.agentName || agentName}
      onSave={() => save()}
      saveBusy={busy}
    >
      {error ? (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      <VoiceTestStep
        state={stateWithId}
        patch={patch}
        onBack={() => router.push(`/voice/agents/${agentId}/capabilities`)}
        onActivate={activate}
        busy={busy}
      />
    </ReceptionistEditorShell>
  );
}
