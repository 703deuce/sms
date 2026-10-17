import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import {
  buildVisualizerEditPrompt,
  normalizeShowerWallHeight,
  type SelectedMaterialRef,
} from "@/lib/visualizer/generation/prompt-builder";
import { runKieBathroomGeneration } from "@/lib/visualizer/generation/provider-kie";
import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";
import { isCatalogMaterialId } from "@/lib/visualizer/catalog-materials";
import { loadMaterialReferenceImage } from "@/lib/visualizer/material-image";
import { downloadVisualizerObject, uploadVisualizerBytes } from "@/lib/visualizer/storage";

export async function enqueueVisualizerGeneration(input: {
  workspaceId: string;
  projectId: string;
  designId: string;
  generationJobId: string;
}) {
  await enqueueJob({
    jobType: "visualizer_generation",
    workspaceId: input.workspaceId,
    idempotencyKey: `visualizer_generation:${input.generationJobId}`,
    payload: {
      workspaceId: input.workspaceId,
      generationJobId: input.generationJobId,
      projectId: input.projectId,
      designId: input.designId,
    },
    priority: 40,
  });
}

export async function executeVisualizerGenerationJob(generationJobId: string) {
  const prisma = getPrisma();
  const job = await prisma.visualizerGenerationJob.findUnique({
    where: { id: generationJobId },
  });
  if (!job) throw new Error("Generation job not found");
  if (job.status === "COMPLETED") return { ok: true, skipped: true };

  const design = job.designId
    ? await prisma.visualizerDesign.findUnique({ where: { id: job.designId } })
    : null;
  if (!design) throw new Error("Design not found for generation job");

  const request = job.requestJson as Record<string, unknown>;
  const originalRoomAssetId = String(design.originalRoomAssetId);
  const roomAsset = await prisma.visualizerAsset.findFirst({
    where: { id: originalRoomAssetId, workspaceId: job.workspaceId },
  });
  if (!roomAsset) throw new Error("Original room photo not found");

  await prisma.visualizerGenerationJob.update({
    where: { id: job.id },
    data: { status: "PREPARING", startedAt: new Date(), provider: "kie" },
  });

  const selectedMaterials = (design.selectedMaterialsJson as SelectedMaterialRef[]) || [];
  const workspaceMaterialIds = selectedMaterials
    .map((m) => m.materialId)
    .filter((id): id is string => Boolean(id) && !isCatalogMaterialId(id));
  const materialRows = await prisma.visualizerMaterial.findMany({
    where: {
      workspaceId: job.workspaceId,
      id: { in: workspaceMaterialIds },
    },
  });

  const referenceImages: Array<{ bytes: Buffer; mime: string; label?: string }> = [];
  let hasSurfacePatternReference = false;
  const promptMaterialRows: Array<{
    id: string;
    name: string;
    category: string;
    description?: string | null;
    finish?: string | null;
  }> = [];

  for (const sel of selectedMaterials) {
    if (!sel.materialId) continue;
    const loaded = await loadMaterialReferenceImage({
      materialId: sel.materialId,
      workspaceMaterials: materialRows,
    });
    referenceImages.push({ bytes: loaded.bytes, mime: loaded.mime, label: loaded.label });
    if (loaded.surfacePatternReference) {
      referenceImages.push({
        bytes: loaded.surfacePatternReference.bytes,
        mime: loaded.surfacePatternReference.mime,
        label: loaded.surfacePatternReference.label,
      });
      hasSurfacePatternReference = true;
    }
    promptMaterialRows.push({
      id: sel.materialId,
      name: loaded.name,
      category: loaded.category,
      description: loaded.description,
      finish: loaded.finish,
    });
  }

  const refAssetIds = (request.referenceAssetIds as string[]) || [];
  if (refAssetIds.length) {
    const refAssets = await prisma.visualizerAsset.findMany({
      where: { id: { in: refAssetIds }, workspaceId: job.workspaceId },
    });
    for (const asset of refAssets) {
      const bytes = await downloadVisualizerObject(asset.bucket, asset.storagePath);
      referenceImages.push({ bytes, mime: asset.mimeType, label: "custom-ref" });
    }
  }

  const roomBytes = await downloadVisualizerObject(roomAsset.bucket, roomAsset.storagePath);

  const prompt = buildVisualizerEditPrompt({
    transformation: design.transformation,
    selectedMaterials,
    materialRows: promptMaterialRows,
    isRevision: Boolean(design.parentDesignId),
    preserve: (request.preserve as Record<string, boolean>) || undefined,
    showerWallHeight: normalizeShowerWallHeight(request.showerWallHeight),
    hasSurfacePatternReference,
  });

  await prisma.visualizerGenerationJob.update({
    where: { id: job.id },
    data: { status: "GENERATING" },
  });

  const existingTaskId =
    typeof request.kieTaskId === "string" && request.kieTaskId.trim()
      ? request.kieTaskId.trim()
      : undefined;

  const result = await runKieBathroomGeneration({
    workspaceId: job.workspaceId,
    prompt,
    roomImage: roomBytes,
    roomMime: roomAsset.mimeType,
    referenceImages,
    existingTaskId,
  });

  if (!existingTaskId && result.taskId) {
    await prisma.visualizerGenerationJob.update({
      where: { id: job.id },
      data: {
        requestJson: {
          ...(request as object),
          kieTaskId: result.taskId,
        },
      },
    });
  }

  await prisma.visualizerGenerationJob.update({
    where: { id: job.id },
    data: { status: "SAVING" },
  });

  const uploaded = await uploadVisualizerBytes({
    workspaceId: job.workspaceId,
    bytes: result.imageBytes,
    mimeType: result.mimeType,
    folder: "generated",
  });

  const generatedAsset = await prisma.visualizerAsset.create({
    data: {
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      assetType: "GENERATED_DESIGN",
      storagePath: uploaded.path,
      bucket: uploaded.bucket,
      mimeType: result.mimeType,
      byteSize: result.imageBytes.length,
      originalFilename: "remodel-preview.png",
    },
  });

  await prisma.visualizerDesign.update({
    where: { id: design.id },
    data: { generatedAssetId: generatedAsset.id },
  });

  await prisma.visualizerProject.update({
    where: { id: job.projectId },
    data: { status: "DESIGN_READY" },
  });

  await prisma.visualizerUsageLedger.create({
    data: {
      workspaceId: job.workspaceId,
      generationJobId: job.id,
      credits: job.usageCredits,
      kind: "generation",
    },
  });

  await prisma.visualizerEvent.create({
    data: {
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      eventType: "design_generated",
      actorType: "system",
      metadata: { designId: design.id, jobId: job.id, kieTaskId: result.taskId },
    },
  });

  await prisma.visualizerGenerationJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      model: result.model,
      completedAt: new Date(),
    },
  });

  return { ok: true, designId: design.id, assetId: generatedAsset.id, kieTaskId: result.taskId };
}
