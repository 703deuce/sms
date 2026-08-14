import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { compileDraftConfig } from "./flow-compiler";
import { validateDraftConfig } from "./flow-validator";
import { templateForType } from "./templates";
import type { DraftConfig, SmartRoutingFlowType } from "./types";
import { parseDraftConfig } from "./session-store";

export async function listFlows(workspaceId: string) {
  const prisma = getPrisma();
  const flows = await prisma.smartRoutingFlow.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
  });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const stats = await prisma.smartRoutingCallSession.groupBy({
    by: ["flowId"],
    where: { workspaceId, startedAt: { gte: todayStart } },
    _count: { _all: true },
  });
  const statMap = new Map(
    stats.map((s: { flowId: string; _count: { _all: number } }) => [s.flowId, s._count._all]),
  );
  return flows.map((f: { id: string }) => ({
    ...f,
    todayCalls: statMap.get(f.id) ?? 0,
  }));
}

export async function getFlow(workspaceId: string, flowId: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingFlow.findFirst({
    where: { id: flowId, workspaceId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 5 },
    },
  });
}

export async function createFlow(
  workspaceId: string,
  input: {
    name?: string;
    type?: SmartRoutingFlowType;
    createdBy?: string;
  },
) {
  const prisma = getPrisma();
  const type = input.type ?? "phone_menu";
  const template = templateForType(type);
  const draftConfig = template.draftConfig;
  return prisma.smartRoutingFlow.create({
    data: {
      id: createId(),
      workspaceId,
      name: input.name?.trim() || template.title,
      type,
      status: "draft",
      draftConfigJson: draftConfig as object,
      createdBy: input.createdBy ?? null,
    },
  });
}

export async function updateFlowDraft(
  workspaceId: string,
  flowId: string,
  patch: {
    name?: string;
    draftConfig?: DraftConfig;
    assignedPhoneNumberId?: string | null;
    numberMode?: string;
    businessNumberE164?: string | null;
    routingNumberE164?: string | null;
    triggerMode?: string;
    scheduleJson?: object;
    timezone?: string;
    status?: string;
  },
) {
  const prisma = getPrisma();
  const existing = await prisma.smartRoutingFlow.findFirst({
    where: { id: flowId, workspaceId },
  });
  if (!existing) throw new Error("Flow not found");

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.name) data.name = patch.name.trim();
  if (patch.draftConfig) data.draftConfigJson = patch.draftConfig as object;
  if (patch.assignedPhoneNumberId !== undefined)
    data.assignedPhoneNumberId = patch.assignedPhoneNumberId;
  if (patch.numberMode) data.numberMode = patch.numberMode;
  if (patch.businessNumberE164 !== undefined)
    data.businessNumberE164 = patch.businessNumberE164;
  if (patch.routingNumberE164 !== undefined) data.routingNumberE164 = patch.routingNumberE164;
  if (patch.triggerMode) data.triggerMode = patch.triggerMode;
  if (patch.scheduleJson) data.scheduleJson = patch.scheduleJson;
  if (patch.timezone) data.timezone = patch.timezone;
  if (patch.status) data.status = patch.status;

  return prisma.smartRoutingFlow.update({ where: { id: flowId }, data });
}

export async function duplicateFlow(workspaceId: string, flowId: string, createdBy?: string) {
  const flow = await getFlow(workspaceId, flowId);
  if (!flow) throw new Error("Flow not found");
  const prisma = getPrisma();
  return prisma.smartRoutingFlow.create({
    data: {
      id: createId(),
      workspaceId,
      name: `${flow.name} (copy)`,
      type: flow.type,
      status: "draft",
      draftConfigJson: flow.draftConfigJson as object,
      numberMode: flow.numberMode,
      businessNumberE164: flow.businessNumberE164,
      routingNumberE164: flow.routingNumberE164,
      triggerMode: flow.triggerMode,
      scheduleJson: flow.scheduleJson as object,
      timezone: flow.timezone,
      createdBy: createdBy ?? null,
    },
  });
}

export async function deleteFlow(workspaceId: string, flowId: string) {
  const prisma = getPrisma();
  const flow = await prisma.smartRoutingFlow.findFirst({
    where: { id: flowId, workspaceId },
  });
  if (!flow) throw new Error("Flow not found");
  if (flow.status === "active") throw new Error("Pause flow before deleting");
  await prisma.smartRoutingFlow.delete({ where: { id: flowId } });
  return { ok: true };
}

export async function validateFlow(workspaceId: string, flowId: string) {
  const flow = await getFlow(workspaceId, flowId);
  if (!flow) throw new Error("Flow not found");
  const draft = parseDraftConfig(flow.draftConfigJson);
  const smsNodes = draft.nodes?.some((n) =>
    ["SMS_CONSENT", "SEND_SMS"].includes(n.type),
  );
  let requireSmsApproval = false;
  if (smsNodes) {
    const { loadComplianceOverview } = await import("@/lib/workspace-data");
    const compliance = await loadComplianceOverview(workspaceId);
    requireSmsApproval = !compliance.ready;
  }
  return validateDraftConfig(draft, {
    requireAudio: true,
    requireSmsApproval,
  });
}

export async function publishFlow(workspaceId: string, flowId: string, createdBy?: string) {
  const validation = await validateFlow(workspaceId, flowId);
  if (!validation.valid) {
    throw new Error(`Flow validation failed: ${validation.issues[0]?.message}`);
  }
  const flow = await getFlow(workspaceId, flowId);
  if (!flow) throw new Error("Flow not found");
  const draft = parseDraftConfig(flow.draftConfigJson);
  const compiled = compileDraftConfig(draft);
  const prisma = getPrisma();
  const lastVersion = await prisma.smartRoutingFlowVersion.findFirst({
    where: { flowId },
    orderBy: { versionNumber: "desc" },
  });
  const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;
  const version = await prisma.smartRoutingFlowVersion.create({
    data: {
      id: createId(),
      flowId,
      versionNumber,
      snapshotJson: draft as object,
      compiledJson: compiled as object,
      status: "published",
      createdBy: createdBy ?? null,
      publishedAt: new Date(),
    },
  });
  await prisma.smartRoutingFlow.update({
    where: { id: flowId },
    data: {
      publishedVersionId: version.id,
      status: "active",
      activatedAt: new Date(),
    },
  });
  return version;
}

export async function pauseFlow(workspaceId: string, flowId: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingFlow.updateMany({
    where: { id: flowId, workspaceId },
    data: { status: "paused" },
  });
}

export async function rollbackFlow(workspaceId: string, flowId: string, versionId: string) {
  const prisma = getPrisma();
  const version = await prisma.smartRoutingFlowVersion.findFirst({
    where: { id: versionId, flowId },
  });
  if (!version) throw new Error("Version not found");
  await prisma.smartRoutingFlow.update({
    where: { id: flowId, workspaceId },
    data: {
      draftConfigJson: version.snapshotJson as object,
      publishedVersionId: version.id,
      status: "active",
    },
  });
  return version;
}

export async function resolveActiveFlowForNumber(workspaceId: string, phoneNumberId: string) {
  const prisma = getPrisma();
  return prisma.smartRoutingFlow.findFirst({
    where: {
      workspaceId,
      assignedPhoneNumberId: phoneNumberId,
      status: "active",
      publishedVersionId: { not: null },
    },
  });
}

export async function getOverviewMetrics(workspaceId: string) {
  const prisma = getPrisma();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [activeFlows, routedToday, recovered, failures] = await Promise.all([
    prisma.smartRoutingFlow.count({ where: { workspaceId, status: "active" } }),
    prisma.smartRoutingCallSession.count({
      where: { workspaceId, startedAt: { gte: todayStart } },
    }),
    prisma.smartRoutingCallSession.count({
      where: {
        workspaceId,
        startedAt: { gte: todayStart },
        smsTriggered: true,
      },
    }),
    prisma.smartRoutingCallSession.count({
      where: {
        workspaceId,
        startedAt: { gte: todayStart },
        finalOutcome: { in: ["routing_error", "transfer_failed"] },
      },
    }),
  ]);
  return { activeFlows, routedToday, recovered, failures };
}
