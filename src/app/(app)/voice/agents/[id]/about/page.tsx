"use client";

import { ReceptionistEditorShell } from "@/components/receptionist/receptionist-editor-shell";
import { AboutStep } from "@/components/receptionist/steps/about-step";
import { useReceptionistAgentState } from "@/components/receptionist/use-receptionist-agent-state";
import { useParams, useRouter } from "next/navigation";

export default function AgentAboutPage() {
  const params = useParams();
  const agentId = params?.id as string;
  const router = useRouter();
  const { state, agentName, loading, busy, error, setError, patch, save } =
    useReceptionistAgentState(agentId);

  if (loading || !state) {
    return (
      <ReceptionistEditorShell agentId={agentId} agentTitle={agentName}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </ReceptionistEditorShell>
    );
  }

  async function continueNext() {
    if (!state) return;
    if (!state.businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    try {
      await save();
      router.push(`/voice/agents/${agentId}/capabilities`);
    } catch {
      // error set in hook
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
      <AboutStep
        state={state}
        patch={patch}
        onContinue={continueNext}
        onCancel={() => router.push("/voice/agents")}
        busy={busy}
      />
    </ReceptionistEditorShell>
  );
}
