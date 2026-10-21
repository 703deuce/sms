import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";
import { withRuntimeProfileFromEditor } from "@/lib/receptionist/runtime-profile";
import type { VoiceV3AgentConfig } from "@/lib/server/voice-v3/config/agent-config";
import { editorToVoiceV3AgentConfig } from "@/lib/server/voice-v3/editor-to-voice-v3-config";

export function voiceV3AgentConfigFromBundle(
  bundle: ReceptionistPublishedBundle,
  ids?: { workspaceId: string; agentId: string; businessName?: string; timezone?: string },
): VoiceV3AgentConfig {
  const snap = bundle.runtime.voiceV3 as {
    voiceV3AgentConfig?: VoiceV3AgentConfig;
    workspaceId?: string;
  };
  if (snap?.voiceV3AgentConfig) {
    const merged = {
      ...snap.voiceV3AgentConfig,
      workspaceId: ids?.workspaceId ?? snap.voiceV3AgentConfig.workspaceId,
      agentId: ids?.agentId ?? snap.voiceV3AgentConfig.agentId,
    };
    return withRuntimeProfileFromEditor(bundle.editor, merged);
  }
  const workspaceId =
    ids?.workspaceId ||
    (typeof snap?.workspaceId === "string" ? snap.workspaceId : undefined) ||
    "unknown";
  return withRuntimeProfileFromEditor(
    bundle.editor,
    editorToVoiceV3AgentConfig({
      editor: bundle.editor,
      workspaceId: String(workspaceId),
      agentId: ids?.agentId || "unknown",
      businessName: ids?.businessName || bundle.editor.identity.role || "Business",
      timezone: ids?.timezone || bundle.editor.identity.language || "America/Chicago",
      knowledge: {
        knowledgeBaseIds: [],
        openaiVectorStoreIds: bundle.runtime.openaiFileSearchVectorStoreIds ?? [],
        documentSourceIds: [],
        faqFacts: [],
        knowledgeItemSummaries: [],
        revision: null,
      },
    }),
  );
}
