import "server-only";

import { getPrisma } from "@/lib/db";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { buildVisualizerEditPrompt, type SelectedMaterialRef } from "@/lib/visualizer/generation/prompt-builder";
import { runOpenAiBathroomEdit } from "@/lib/visualizer/generation/provider-openai";
import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";
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
    data: { status: "PREPARING", startedAt: new Date() },
  });

  const selectedMaterials = (design.selectedMaterialsJson as SelectedMaterialRef[]) || [];
  const materialRows = await prisma.visualizerMaterial.findMany({
    where: {
      workspaceId: job.workspaceId,
      id: {
        in: selectedMaterials.map((m) => m.materialId).filter(Boolean) as string[],
      },
    },
  });

  const referenceImages: Array<{ bytes: Buffer; mime: string }> = [];
  for (const row of materialRows) {
    const bytes = await downloadVisualizerObject(VISUALIZER_BUCKET, row.imageStoragePath);
    referenceImages.push({ bytes, mime: row.imageMimeType });
  }

  const refAssetIds = (request.referenceAssetIds as string[]) || [];
  if (refAssetIds.length) {
    const refAssets = await prisma.visualizerAsset.findMany({
      where: { id: { in: refAssetIds }, workspaceId: job.workspaceId },
    });
    for (const asset of refAssets) {
      const bytes = await downloadVisualizerObject(asset.bucket, asset.storagePath);
      referenceImages.push({ bytes, mime: asset.mimeType });
    }
  }

  const roomBytes = await downloadVisualizerObject(roomAsset.bucket, roomAsset.storagePath);

  const prompt = buildVisualizerEditPrompt({
    transformation: design.transformation,
    selectedMaterials: selectedMaterials.map((m) => ({
      ...m,
      name: materialRows.find((r) => r.id === m.materialId)?.name || m.name,
    })),
    additionalInstructions: design.instructions,
    isRevision: Boolean(design.parentDesignId),
    preserve: (request.preserve as Record<string, boolean>) || undefined,
  });

  await prisma.visualizerGenerationJob.update({
    where: { id: job.id },
    data: { status: "GENERATING" },
  });

  const provider = job.provider || "openai";
  let resultBytes: Buffer;
  let resultMime: string;
  let modelUsed: string;

  if (provider === "openai") {
    const result = await runOpenAiBathroomEdit({
      roomImage: roomBytes,
      roomMime: roomAsset.mimeType,
      referenceImages,
      prompt,
    });
    resultBytes = result.imageBytes;
    resultMime = result.mimeType;
    modelUsed = result.model;
  } else {
    throw new Error(`Unsupported visualizer provider: ${provider}`);
  }

  await prisma.visualizerGenerationJob.update({
    where: { id: job.id },
    data: { status: "SAVING" },
  });

  const uploaded = await uploadVisualizerBytes({
    workspaceId: job.workspaceId,
    bytes: resultBytes,
    mimeType: resultMime,
    folder: "generated",
  });

  const generatedAsset = await prisma.visualizerAsset.create({
    data: {
      workspaceId: job.workspaceId,
      projectId: job.projectId,
      assetType: "GENERATED_DESIGN",
      storagePath: uploaded.path,
      bucket: uploaded.bucket,
      mimeType: resultMime,
      byteSize: resultBytes.length,
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
      metadata: { designId: design.id, jobId: job.id },
    },
  });

  await prisma.visualizerGenerationJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      model: modelUsed,
      completedAt: new Date(),
    },
  });

  return { ok: true, designId: design.id, assetId: generatedAsset.id };
}
