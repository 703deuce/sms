"use client";

import { ReceptionistEditorShell } from "@/components/receptionist/receptionist-editor-shell";
import { CapabilitiesStep } from "@/components/receptionist/steps/capabilities-step";
import { useReceptionistAgentState } from "@/components/receptionist/use-receptionist-agent-state";
import { useParams, useRouter } from "next/navigation";

export default function AgentCapabilitiesPage() {
  const params = useParams();
  const agentId = params?.id as string;
  const router = useRouter();
  const { state, agentName, loading, busy, error, setError, patch, patchAdvanced, advanced, save, buildForTest } =
    useReceptionistAgentState(agentId);

  if (loading || !state || !advanced) {
    return (
      <ReceptionistEditorShell agentId={agentId}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </ReceptionistEditorShell>
    );
  }

  async function continueNext() {
    try {
      await save();
      await buildForTest();
      router.push(`/voice/agents/${agentId}/voice-test`);
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
      <CapabilitiesStep
        state={{ ...state, agentId }}
        advanced={advanced}
        patch={patch}
        patchAdvanced={patchAdvanced}
        onBack={() => router.push(`/voice/agents/${agentId}/about`)}
        onContinue={continueNext}
        busy={busy}
      />
    </ReceptionistEditorShell>
  );
}
