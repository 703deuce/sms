import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueVisualizerGeneration } from "@/lib/visualizer/generation/run-generation-job";
import {
  normalizeShowerWallHeight,
  type SelectedMaterialRef,
  type ShowerWallHeight,
} from "@/lib/visualizer/generation/prompt-builder";
import { VISUALIZER_DEFAULT_SHOWER_WALL_HEIGHT } from "@/lib/visualizer/constants";

export async function startProjectGeneration(input: {
  workspaceId: string;
  projectId: string;
  transformation: string;
  originalRoomAssetId: string;
  selectedMaterials: SelectedMaterialRef[];
  instructions?: string;
  parentDesignId?: string;
  referenceAssetIds?: string[];
  preserve?: Record<string, boolean>;
  showerWallHeight?: ShowerWallHeight | string | null;
  idempotencyKey: string;
}) {
  const prisma = getPrisma();
  const project = await prisma.visualizerProject.findFirst({
    where: { id: input.projectId, workspaceId: input.workspaceId },
  });
  if (!project) throw new Error("Project not found");

  let showerWallHeight = input.showerWallHeight
    ? normalizeShowerWallHeight(input.showerWallHeight)
    : null;
  if (!showerWallHeight && input.parentDesignId) {
    const parent = await prisma.visualizerDesign.findFirst({
      where: { id: input.parentDesignId, workspaceId: input.workspaceId },
      select: { generationJobId: true },
    });
    if (parent?.generationJobId) {
      const parentJob = await prisma.visualizerGenerationJob.findUnique({
        where: { id: parent.generationJobId },
        select: { requestJson: true },
      });
      const raw = (parentJob?.requestJson as { showerWallHeight?: unknown } | null)?.showerWallHeight;
      if (raw) showerWallHeight = normalizeShowerWallHeight(raw);
    }
  }
  if (!showerWallHeight) {
    showerWallHeight = VISUALIZER_DEFAULT_SHOWER_WALL_HEIGHT;
  }

  const priorCount = await prisma.visualizerDesign.count({
    where: { projectId: input.projectId },
  });

  const design = await prisma.visualizerDesign.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      parentDesignId: input.parentDesignId || null,
      versionNumber: priorCount + 1,
      originalRoomAssetId: input.originalRoomAssetId,
      transformation: input.transformation as never,
      selectedMaterialsJson: input.selectedMaterials,
      instructions: input.instructions || null,
    },
  });

  const job = await prisma.visualizerGenerationJob.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      designId: design.id,
      idempotencyKey: input.idempotencyKey,
      requestJson: {
        transformation: input.transformation,
        selectedMaterials: input.selectedMaterials,
        referenceAssetIds: input.referenceAssetIds || [],
        preserve: input.preserve || {},
        instructions: input.instructions || null,
        showerWallHeight,
      },
    },
  });

  await prisma.visualizerDesign.update({
    where: { id: design.id },
    data: { generationJobId: job.id },
  });

  await enqueueVisualizerGeneration({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    designId: design.id,
    generationJobId: job.id,
  });

  return { designId: design.id, generationJobId: job.id };
}

export async function getVisualizerOverviewMetrics(workspaceId: string) {
  const prisma = getPrisma();
  const [designsCreated, designsShared, estimateRequests, appointmentsScheduled] =
    await Promise.all([
      prisma.visualizerDesign.count({ where: { workspaceId } }),
      prisma.visualizerShare.count({ where: { workspaceId } }),
      prisma.visualizerEstimateRequest.count({ where: { workspaceId } }),
      prisma.visualizerEstimateRequest.count({
        where: { workspaceId, status: "APPOINTMENT_SCHEDULED" },
      }),
    ]);
  return {
    designsCreated,
    designsShared,
    estimateRequests,
    appointmentsScheduled,
  };
}
