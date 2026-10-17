import { jsonError, requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { signedAssetUrl } from "@/lib/visualizer/serialize";
import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";
import { getVisualizerSignedUrl } from "@/lib/visualizer/storage";

type Params = { params: Promise<{ designId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const { designId } = await params;
  const prisma = getPrisma();
  const design = await prisma.visualizerDesign.findFirst({
    where: { id: designId, workspaceId: auth.workspaceId },
  });
  if (!design) return jsonError("Design not found", 404);

  const project = await prisma.visualizerProject.findUnique({ where: { id: design.projectId } });
  let beforeUrl: string | null = null;
  const beforeAsset = await prisma.visualizerAsset.findUnique({
    where: { id: design.originalRoomAssetId },
  });
  if (beforeAsset) beforeUrl = await signedAssetUrl(beforeAsset);

  let afterUrl: string | null = null;
  if (design.generatedAssetId) {
    const afterAsset = await prisma.visualizerAsset.findUnique({ where: { id: design.generatedAssetId } });
    if (afterAsset) afterUrl = await signedAssetUrl(afterAsset);
  }

  const selected = (design.selectedMaterialsJson as Array<{ materialId?: string; category: string }>) || [];
  const materials = await prisma.visualizerMaterial.findMany({
    where: {
      workspaceId: auth.workspaceId,
      id: { in: selected.map((s) => s.materialId).filter(Boolean) as string[] },
    },
  });

  const materialRows = await Promise.all(
    materials.map(async (m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      sku: m.sku,
      finish: m.finish,
      imageUrl: await getVisualizerSignedUrl(VISUALIZER_BUCKET, m.imageStoragePath, 7200),
    })),
  );

  const job = design.generationJobId
    ? await prisma.visualizerGenerationJob.findUnique({ where: { id: design.generationJobId } })
    : null;

  return Response.json({
    design: {
      id: design.id,
      projectId: design.projectId,
      projectName: project?.name,
      versionNumber: design.versionNumber,
      isFavorite: design.isFavorite,
      instructions: design.instructions,
      transformation: design.transformation,
      beforeUrl,
      afterUrl,
      materials: materialRows,
      jobStatus: job?.status || null,
      jobError: job?.errorMessage || null,
    },
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const { designId } = await params;
  const body = (await req.json()) as { isFavorite?: boolean };
  const prisma = getPrisma();

  const design = await prisma.visualizerDesign.findFirst({
    where: { id: designId, workspaceId: auth.workspaceId },
  });
  if (!design) return jsonError("Design not found", 404);

  if (body.isFavorite === true) {
    await prisma.visualizerDesign.updateMany({
      where: { projectId: design.projectId },
      data: { isFavorite: false },
    });
    await prisma.visualizerProject.update({
      where: { id: design.projectId },
      data: { status: "INTERESTED" },
    });
    await prisma.visualizerEvent.create({
      data: {
        workspaceId: auth.workspaceId,
        projectId: design.projectId,
        eventType: "favorite_selected",
        actorType: "user",
        actorId: auth.session.userId,
        metadata: { designId },
      },
    });
  }

  const updated = await prisma.visualizerDesign.update({
    where: { id: designId },
    data: {
      ...(typeof body.isFavorite === "boolean" ? { isFavorite: body.isFavorite } : {}),
    },
  });

  return Response.json({ design: updated });
}
