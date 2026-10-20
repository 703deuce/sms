import type { AgentConfig } from "@/lib/agent";
import { getPrisma } from "@/lib/server/db";
import { compilePublishedBundle } from "@/lib/server/receptionist/compile-runtime";
import { normalizeReceptionistEditor } from "@/lib/server/receptionist/normalize-editor";
import {
  resolveReceptionistBusinessFacts,
  resolveReceptionistBusinessTimezone,
} from "@/lib/server/receptionist/business-facts";
import {
  buildKnowledgeCompileSlice,
  prepareKnowledgeForPublish,
} from "@/lib/server/receptionist/knowledge-compile";
import { validateReceptionistPublish } from "@/lib/server/voice-v3/publish-gate";
import {
  ensureWorkspaceReceptionistAgent,
  findWorkspaceReceptionistAgent,
  loadDraftFromAgent,
  loadLiveEditorFromPublished,
  mapAgentStatusToUi,
  saveDraftEnvelope,
} from "@/lib/server/receptionist/agent-store";
import type { ReceptionistPublishedBundle } from "@/lib/server/receptionist/draft-types";
import { syncReceptionistPhoneAssignment } from "@/lib/server/receptionist/phone-assignment";
import { alignEditorConnectionForPublish } from "@/lib/server/receptionist/resolve-publish-phone";
import { buildVoiceAgentRuntimeConfigFromEditor } from "@/lib/server/receptionist/map-editor-to-runtime-config";
import { hydrateConversationalRoutesFromPhone } from "@/lib/server/receptionist/hydrate-conversational-routes-from-phone";

export type ReceptionistStateDto = {
  agentId: string;
  live: AgentConfig;
  draft: AgentConfig;
  status: "active" | "paused" | "draft" | "publishing" | "sync_failed";
  draftRevision: number;
  publishedVersion: number | null;
  lastSaved: string | null;
  lastPublished: string | null;
  unsaved: boolean;
};

function businessNameFromWorkspace(name: string | null | undefined): string {
  return name?.trim() || "your business";
}

export async function compileReceptionistRuntimeBundle(input: {
  workspaceId: string;
  agentId: string;
  editor: AgentConfig;
  syncKnowledge?: boolean;
}): Promise<ReceptionistPublishedBundle> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true },
  });
  const businessName = businessNameFromWorkspace(workspace?.name);
  const timezone = await resolveReceptionistBusinessTimezone(input.workspaceId);
  const businessFacts = await resolveReceptionistBusinessFacts(
    input.workspaceId,
    input.editor,
  );
  const knowledge = input.syncKnowledge
    ? await prepareKnowledgeForPublish({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
      })
    : await buildKnowledgeCompileSlice({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
      });

  return compilePublishedBundle({
    editor: input.editor,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    businessName,
    timezone,
    businessFacts,
    knowledge,
  });
}

export async function getReceptionistState(workspaceId: string): Promise<ReceptionistStateDto> {
  const agent = await ensureWorkspaceReceptionistAgent(workspaceId);
  const prisma = getPrisma();
  const draftEnvelope = loadDraftFromAgent(agent);

  let live = draftEnvelope.editor;
  let publishedVersion: number | null = null;
  let lastPublished: string | null = null;

  if (agent.publishedVersionId) {
    const version = await prisma.voiceAgentVersion.findUnique({
      where: { id: agent.publishedVersionId },
    });
    if (version) {
      publishedVersion = version.version;
      lastPublished = version.publishedAt.toISOString();
      live = loadLiveEditorFromPublished(version.config, draftEnvelope.editor);
    }
  }

  const unsaved = JSON.stringify(live) !== JSON.stringify(draftEnvelope.editor);

  return {
    agentId: agent.id,
    live: normalizeReceptionistEditor(live),
    draft: normalizeReceptionistEditor(draftEnvelope.editor),
    status: mapAgentStatusToUi(agent.status, agent.emergencyDisabled),
    draftRevision: draftEnvelope.draftRevision,
    publishedVersion,
    lastSaved: draftEnvelope.updatedAt,
    lastPublished,
    unsaved,
  };
}

export async function patchReceptionistDraft(
  workspaceId: string,
  patch: Partial<AgentConfig> | AgentConfig,
  expectedRevision?: number,
): Promise<ReceptionistStateDto> {
  const agent = await ensureWorkspaceReceptionistAgent(workspaceId);
  const current = loadDraftFromAgent(agent);
  const merged =
    patch && typeof patch === "object" && "identity" in patch
      ? (patch as AgentConfig)
      : { ...current.editor, ...patch };

  await saveDraftEnvelope(agent.id, workspaceId, { ...current, editor: merged }, expectedRevision);
  await syncReceptionistPhoneAssignment(workspaceId, agent.id, merged);
  return getReceptionistState(workspaceId);
}

export async function publishReceptionist(workspaceId: string): Promise<{
  ok: boolean;
  errors?: string[];
  state?: ReceptionistStateDto;
}> {
  const prisma = getPrisma();
  const agent = await ensureWorkspaceReceptionistAgent(workspaceId);
  const draftEnvelope = loadDraftFromAgent(agent);

  const alignedEditor = await alignEditorConnectionForPublish(workspaceId, draftEnvelope.editor);
  if (JSON.stringify(alignedEditor.connection) !== JSON.stringify(draftEnvelope.editor.connection)) {
    await saveDraftEnvelope(
      agent.id,
      workspaceId,
      { ...draftEnvelope, editor: alignedEditor },
    );
    draftEnvelope.editor = alignedEditor;
  }

  const hydratedEditor = await hydrateConversationalRoutesFromPhone(workspaceId, draftEnvelope.editor);
  draftEnvelope.editor = hydratedEditor;

  const validation = await validateReceptionistPublish(workspaceId, draftEnvelope.editor);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

  const businessName = businessNameFromWorkspace(workspace?.name);
  const timezone = await resolveReceptionistBusinessTimezone(workspaceId);
  const businessFacts = await resolveReceptionistBusinessFacts(workspaceId, draftEnvelope.editor);
  const knowledge = await prepareKnowledgeForPublish({
    workspaceId,
    agentId: agent.id,
  });

  const bundle = compilePublishedBundle({
    editor: draftEnvelope.editor,
    workspaceId,
    agentId: agent.id,
    businessName,
    timezone,
    businessFacts,
    knowledge,
  });

  const lastVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId: agent.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  const runtimeVoiceConfig = buildVoiceAgentRuntimeConfigFromEditor(
    draftEnvelope.editor,
    bundle,
  );

  const version = await prisma.voiceAgentVersion.create({
    data: {
      workspaceId,
      agentId: agent.id,
      version: nextVersion,
      config: runtimeVoiceConfig,
      changeLog: "Published from new-app receptionist",
      isMain: true,
      deploymentStatus: "published",
    },
  });

  await prisma.voiceAgentVersion.updateMany({
    where: { agentId: agent.id, id: { not: version.id } },
    data: { isMain: false },
  });

  await prisma.voiceAgent.update({
    where: { id: agent.id },
    data: {
      publishedVersionId: version.id,
      status: agent.emergencyDisabled ? "PAUSED" : "ACTIVE",
      healthStatus: "ok",
      healthMessage: null,
    },
  });

  const lkResult = await syncReceptionistPhoneAssignment(workspaceId, agent.id, draftEnvelope.editor, {
    publish: true,
    publishedBundle: bundle,
  });

  const state = await getReceptionistState(workspaceId);
  if (lkResult && lkResult.ok === false) {
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: { status: "CONFIGURATION_ERROR", healthMessage: lkResult.error || "LiveKit provision failed" },
    });
    return {
      ok: false,
      errors: [lkResult.error || "LiveKit provisioning failed"],
      state: await getReceptionistState(workspaceId),
    };
  }

  return { ok: true, state };
}

export async function pauseReceptionist(workspaceId: string): Promise<ReceptionistStateDto> {
  const agent = await ensureWorkspaceReceptionistAgent(workspaceId);
  const prisma = getPrisma();
  await prisma.voiceAgent.update({
    where: { id: agent.id },
    data: { status: "PAUSED", emergencyDisabled: true },
  });
  await syncReceptionistPhoneAssignment(workspaceId, agent.id, loadDraftFromAgent(agent).editor, {
    paused: true,
  });
  return getReceptionistState(workspaceId);
}

export async function resumeReceptionist(workspaceId: string): Promise<ReceptionistStateDto> {
  const agent = await ensureWorkspaceReceptionistAgent(workspaceId);
  const prisma = getPrisma();
  if (!agent.publishedVersionId) {
    throw new Error("Publish before resuming live AI coverage.");
  }
  await prisma.voiceAgent.update({
    where: { id: agent.id },
    data: { status: "ACTIVE", emergencyDisabled: false },
  });
  const draft = loadDraftFromAgent(agent).editor;
  await syncReceptionistPhoneAssignment(workspaceId, agent.id, draft, { paused: false });
  return getReceptionistState(workspaceId);
}

export async function discardReceptionistDraft(workspaceId: string): Promise<ReceptionistStateDto> {
  const agent = await ensureWorkspaceReceptionistAgent(workspaceId);
  const prisma = getPrisma();
  const current = loadDraftFromAgent(agent);
  let liveEditor = current.editor;

  if (agent.publishedVersionId) {
    const version = await prisma.voiceAgentVersion.findUnique({
      where: { id: agent.publishedVersionId },
    });
    if (version) {
      liveEditor = loadLiveEditorFromPublished(version.config, liveEditor);
    }
  }

  await saveDraftEnvelope(agent.id, workspaceId, { ...current, editor: liveEditor });
  return getReceptionistState(workspaceId);
}

export async function loadPublishedBundleForAgent(
  agentId: string,
  workspaceId: string,
): Promise<ReceptionistPublishedBundle | null> {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent?.publishedVersionId) return null;
  const version = await prisma.voiceAgentVersion.findUnique({
    where: { id: agent.publishedVersionId },
  });
  if (!version?.config || typeof version.config !== "object") return null;
  return version.config as ReceptionistPublishedBundle;
}
