"use client";

import { ReceptionistEditorShell } from "@/components/receptionist/receptionist-editor-shell";
import { VoiceTestStep } from "@/components/receptionist/steps/voice-test-step";
import { useReceptionistAgentState } from "@/components/receptionist/use-receptionist-agent-state";
import { useParams, useRouter } from "next/navigation";

export default function AgentVoiceTestPage() {
  const params = useParams();
  const agentId = params?.id as string;
  const router = useRouter();
  const { state, agentName, loading, busy, error, setError, patch, save, publish, buildForTest, phoneNumberId, phoneE164, assignPhone } =
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
    if (!phoneNumberId) {
      setError("Assign a phone number before activating — pick one under Test in browser.");
      return;
    }
    try {
      await save();
      await buildForTest();
      await publish();
    } catch {
      // error in hook
    }
  }

  return (
    <ReceptionistEditorShell
      agentId={agentId}
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
        phoneNumberId={phoneNumberId}
        phoneE164={phoneE164}
        onPhoneChange={(id) => assignPhone(id).catch(() => undefined)}
      />
    </ReceptionistEditorShell>
  );
}
