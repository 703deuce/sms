import { createHash } from "node:crypto";
import type { AgentConfig } from "@/lib/agent";

/**
 * Stable digest of new-app receptionist editor (four screens) for observability.
 * Used to prove PSTN runtime tracks published UI settings — not legacy wizard JSON.
 */
export function buildReceptionistEditorConfigDigest(editor: AgentConfig): string {
  const payload = {
    source: "new_app_four_screens",
    identity: editor.identity,
    style: editor.style,
    capabilities: editor.capabilities,
    knowledgeProfile: editor.knowledgeProfile,
    appointments: {
      provider: editor.appointments.provider,
      strategy: editor.appointments.strategy,
      bookingLink: editor.appointments.bookingLink,
      types: editor.appointments.types.map((t) => ({
        id: t.id,
        enabled: t.enabled,
        booking: t.booking,
        duration: t.duration,
      })),
    },
    coverage: editor.coverage,
    transfers: editor.transfers,
    messages: editor.messages,
    intake: editor.intake,
    qualification: editor.qualification,
    instructions: editor.instructions,
    connection: editor.connection,
  };
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

export type ReceptionistConfigProvenance = {
  configSource: "new_app_receptionist";
  editorDigest: string;
  screens: ["agent", "knowledge", "call_handling", "appointments"];
  legacyWizardUsed: false;
};

export function buildReceptionistConfigProvenance(editor: AgentConfig): ReceptionistConfigProvenance {
  return {
    configSource: "new_app_receptionist",
    editorDigest: buildReceptionistEditorConfigDigest(editor),
    screens: ["agent", "knowledge", "call_handling", "appointments"],
    legacyWizardUsed: false,
  };
}
