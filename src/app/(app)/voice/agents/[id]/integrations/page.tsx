"use client";

import { ReceptionistEditorShell } from "@/components/receptionist/receptionist-editor-shell";
import { ReceptionistIntegrationsPanel } from "@/components/receptionist/receptionist-integrations-panel";
import { useReceptionistAgentState } from "@/components/receptionist/use-receptionist-agent-state";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function AgentIntegrationsPage() {
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

  const bookAppts = state.capabilities.includes("book_appointments");
  const needsCrm =
    bookAppts ||
    state.capabilities.includes("collect_info") ||
    state.capabilities.includes("take_messages");

  return (
    <ReceptionistEditorShell
      agentId={agentId}
      agentTitle={state.agentName || agentName}
      onSave={() => save()}
      saveBusy={busy}
    >
      <div className="mb-6">
        <h2 className="font-display text-xl font-semibold tracking-tight">Connect integrations</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Link Calendly for booking and your CRM so {state.agentName || "Amy"} can sync callers,
          appointments, and pipeline activity. Connections apply to your whole workspace.
        </p>
        <Link
          href="/integrations"
          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
        >
          Open full integrations directory →
        </Link>
      </div>
      <ReceptionistIntegrationsPanel
        agentId={agentId}
        showCalendar={bookAppts}
        showCrm={needsCrm}
      />
      <div className="mt-8 flex justify-between border-t border-border pt-6">
        <Link
          href={`/voice/agents/${agentId}/capabilities`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← Back to capabilities
        </Link>
        <Link href={`/voice/agents/${agentId}/voice-test`} className="voice-btn-primary text-sm">
          Continue to Voice &amp; Test
        </Link>
      </div>
    </ReceptionistEditorShell>
  );
}
