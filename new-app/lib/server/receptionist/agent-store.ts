import type { VoiceAgent, VoiceAgentStatus } from "@prisma/client";
import type { AgentConfig } from "@/lib/agent";
import { getPrisma } from "@/lib/server/db";
import {
  RECEPTIONIST_AGENT_TYPE,
  RECEPTIONIST_DRAFT_SCHEMA_VERSION,
} from "@/lib/server/receptionist/constants";
import { defaultReceptionistEditorConfig } from "@/lib/server/receptionist/defaults";
import { normalizeReceptionistEditor } from "@/lib/server/receptionist/normalize-editor";
import type { ReceptionistDraftEnvelope } from "@/lib/server/receptionist/draft-types";

function parseDraft(raw: unknown): ReceptionistDraftEnvelope | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as ReceptionistDraftEnvelope;
  if (o.schemaVersion !== RECEPTIONIST_DRAFT_SCHEMA_VERSION || !o.editor) return null;
  return o;
}

export async function findWorkspaceReceptionistAgent(workspaceId: string): Promise<VoiceAgent | null> {
  const prisma = getPrisma();
  return prisma.voiceAgent.findFirst({
    where: {
      workspaceId,
      agentType: RECEPTIONIST_AGENT_TYPE,
      archivedAt: null,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function ensureWorkspaceReceptionistAgent(workspaceId: string): Promise<VoiceAgent> {
  const existing = await findWorkspaceReceptionistAgent(workspaceId);
  if (existing) return existing;

  const editor = defaultReceptionistEditorConfig();
  const envelope: ReceptionistDraftEnvelope = {
    schemaVersion: RECEPTIONIST_DRAFT_SCHEMA_VERSION,
    draftRevision: 1,
    updatedAt: new Date().toISOString(),
    editor,
  };

  const prisma = getPrisma();
  return prisma.voiceAgent.create({
    data: {
      workspaceId,
      name: editor.identity.name || "AI Receptionist",
      displayName: editor.identity.name || "AI Receptionist",
      agentType: RECEPTIONIST_AGENT_TYPE,
      purpose: "appointment_receptionist",
      status: "DRAFT",
      draftConfig: envelope,
      executionType: "realtime_voice",
    },
  });
}

export function loadDraftFromAgent(agent: VoiceAgent): ReceptionistDraftEnvelope {
  const parsed = parseDraft(agent.draftConfig);
  if (parsed) {
    return { ...parsed, editor: normalizeReceptionistEditor(parsed.editor) };
  }
  const editor = defaultReceptionistEditorConfig();
  return {
    schemaVersion: RECEPTIONIST_DRAFT_SCHEMA_VERSION,
    draftRevision: 1,
    updatedAt: agent.updatedAt.toISOString(),
    editor,
  };
}

export function loadLiveEditorFromPublished(
  publishedConfig: unknown,
  fallback: AgentConfig,
): AgentConfig {
  if (!publishedConfig || typeof publishedConfig !== "object") return fallback;
  const row = publishedConfig as {
    newAppReceptionist?: { editor?: AgentConfig };
  };
  if (row.newAppReceptionist?.editor) {
    return normalizeReceptionistEditor(row.newAppReceptionist.editor);
  }
  return fallback;
}

export async function saveDraftEnvelope(
  agentId: string,
  workspaceId: string,
  envelope: ReceptionistDraftEnvelope,
  expectedRevision?: number,
): Promise<ReceptionistDraftEnvelope> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  const current = loadDraftFromAgent(agent);
  if (expectedRevision != null && expectedRevision !== current.draftRevision) {
    throw new Error("Draft was updated elsewhere. Reload and try again.");
  }

  const next: ReceptionistDraftEnvelope = {
    ...envelope,
    schemaVersion: RECEPTIONIST_DRAFT_SCHEMA_VERSION,
    draftRevision: current.draftRevision + 1,
    updatedAt: new Date().toISOString(),
  };

  await prisma.voiceAgent.update({
    where: { id: agentId },
    data: {
      draftConfig: next,
      name: next.editor.identity.name || agent.name,
      displayName: next.editor.identity.name || agent.displayName,
    },
  });

  return next;
}

export function mapAgentStatusToUi(
  status: VoiceAgentStatus,
  emergencyDisabled: boolean,
): "active" | "paused" | "draft" | "publishing" | "sync_failed" {
  if (emergencyDisabled || status === "PAUSED") return "paused";
  if (status === "ACTIVE" || status === "TESTING") return "active";
  if (status === "CONFIGURATION_ERROR") return "sync_failed";
  return "draft";
}
