import { jsonError, requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { signedAssetUrl } from "@/lib/visualizer/serialize";
import {
  catalogMaterialPublicUrl,
  getCatalogMaterialById,
  isCatalogMaterialId,
} from "@/lib/visualizer/catalog-materials";
import {
  VISUALIZER_BUCKET,
  VISUALIZER_PANEL_LINE_LABELS,
  type VisualizerPanelLine,
} from "@/lib/visualizer/constants";
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
  const workspaceIds = selected.map((s) => s.materialId).filter((id): id is string => Boolean(id) && !isCatalogMaterialId(id));
  const materials = await prisma.visualizerMaterial.findMany({
    where: {
      workspaceId: auth.workspaceId,
      id: { in: workspaceIds },
    },
  });

  const materialRows = await Promise.all(
    selected.map(async (sel) => {
      if (sel.materialId && isCatalogMaterialId(sel.materialId)) {
        const cat = getCatalogMaterialById(sel.materialId);
        if (!cat) return null;
        return {
          id: sel.materialId,
          name: cat.name,
          category: cat.category,
          sku: cat.sku,
          finish: null,
          panelLine: cat.panelLine,
          panelLineLabel: VISUALIZER_PANEL_LINE_LABELS[cat.panelLine as VisualizerPanelLine] ?? cat.panelLine,
          imageUrl: catalogMaterialPublicUrl(cat),
        };
      }
      const m = materials.find((row) => row.id === sel.materialId);
      if (!m) return null;
      return {
        id: m.id,
        name: m.name,
        category: m.category,
        sku: m.sku,
        finish: m.finish,
        imageUrl: await getVisualizerSignedUrl(VISUALIZER_BUCKET, m.imageStoragePath, 7200),
      };
    }),
  ).then((rows) => rows.filter(Boolean) as Array<{
    id: string;
    name: string;
    category: string;
    sku: string | null;
    finish: string | null;
    panelLine?: string | null;
    panelLineLabel?: string | null;
    imageUrl: string;
  }>);

  const job = design.generationJobId
    ? await prisma.visualizerGenerationJob.findUnique({ where: { id: design.generationJobId } })
    : null;

  const selectedMaterialsJson =
    (design.selectedMaterialsJson as Array<{ materialId?: string; category: string; name?: string }>) ||
    [];

  return Response.json({
    design: {
      id: design.id,
      projectId: design.projectId,
      projectName: project?.name,
      versionNumber: design.versionNumber,
      parentDesignId: design.parentDesignId,
      originalRoomAssetId: design.originalRoomAssetId,
      isFavorite: design.isFavorite,
      instructions: design.instructions,
      transformation: design.transformation,
      selectedMaterials: selectedMaterialsJson,
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
