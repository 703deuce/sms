import type { AgentConfig } from "@/lib/agent";
import { getPrisma } from "@/lib/server/db";
import {
  compilePublishedBundle,
  validateEditorForPublish,
} from "@/lib/server/receptionist/compile-runtime";
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
    live,
    draft: draftEnvelope.editor,
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

  const validation = validateEditorForPublish(draftEnvelope.editor);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });

  const bundle = compilePublishedBundle({
    editor: draftEnvelope.editor,
    workspaceId,
    businessName: businessNameFromWorkspace(workspace?.name),
  });

  const lastVersion = await prisma.voiceAgentVersion.findFirst({
    where: { agentId: agent.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (lastVersion?.version ?? 0) + 1;

  const version = await prisma.voiceAgentVersion.create({
    data: {
      workspaceId,
      agentId: agent.id,
      version: nextVersion,
      config: bundle as unknown as object,
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

  await syncReceptionistPhoneAssignment(workspaceId, agent.id, draftEnvelope.editor, {
    publish: true,
    publishedBundle: bundle,
  });

  return { ok: true, state: await getReceptionistState(workspaceId) };
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
