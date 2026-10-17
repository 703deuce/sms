import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueVisualizerGeneration } from "@/lib/visualizer/generation/run-generation-job";
import type { SelectedMaterialRef } from "@/lib/visualizer/generation/prompt-builder";

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
  idempotencyKey: string;
}) {
  const prisma = getPrisma();
  const project = await prisma.visualizerProject.findFirst({
    where: { id: input.projectId, workspaceId: input.workspaceId },
  });
  if (!project) throw new Error("Project not found");

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
