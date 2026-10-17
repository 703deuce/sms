import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { resolveShareByToken } from "@/lib/visualizer/share";
import { signedAssetUrl } from "@/lib/visualizer/serialize";
import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";
import { getVisualizerSignedUrl } from "@/lib/visualizer/storage";

type Params = { params: Promise<{ slug: string; token: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug, token } = await params;
  const resolved = await resolveShareByToken(slug, token);
  if (!resolved) return jsonError("This preview link is invalid or expired.", 404);

  const { share, workspace } = resolved;
  const prisma = getPrisma();
  const design = await prisma.visualizerDesign.findUnique({ where: { id: share.designId } });
  if (!design) return jsonError("Design not found", 404);

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

  let materials: Array<{ name: string; category: string; finish: string | null }> = [];
  if (share.showMaterials) {
    const selected = (design.selectedMaterialsJson as Array<{ materialId?: string }>) || [];
    const rows = await prisma.visualizerMaterial.findMany({
      where: {
        workspaceId: workspace.id,
        id: { in: selected.map((s) => s.materialId).filter(Boolean) as string[] },
      },
    });
    materials = rows.map((m) => ({
      name: m.name,
      category: m.category,
      finish: m.finish,
    }));
  }

  await prisma.visualizerEvent.create({
    data: {
      workspaceId: workspace.id,
      projectId: share.projectId,
      eventType: "design_viewed",
      actorType: "customer",
      metadata: { shareId: share.id },
    },
  });

  return Response.json({
    companyName: workspace.name,
    design: {
      id: design.id,
      projectId: design.projectId,
      beforeUrl,
      afterUrl,
      isFavorite: design.isFavorite,
    },
    materials,
    allowEstimateRequest: share.allowEstimateRequest,
  });
}

export async function POST(req: Request, { params }: Params) {
  const { slug, token } = await params;
  const resolved = await resolveShareByToken(slug, token);
  if (!resolved) return jsonError("This preview link is invalid or expired.", 404);

  const body = (await req.json()) as { action?: string; designId?: string };
  const prisma = getPrisma();

  if (body.action === "favorite" && body.designId) {
    await prisma.visualizerDesign.updateMany({
      where: { projectId: resolved.share.projectId },
      data: { isFavorite: false },
    });
    await prisma.visualizerDesign.update({
      where: { id: body.designId },
      data: { isFavorite: true },
    });
    await prisma.visualizerProject.update({
      where: { id: resolved.share.projectId },
      data: { status: "INTERESTED" },
    });
    await prisma.visualizerEvent.create({
      data: {
        workspaceId: resolved.share.workspaceId,
        projectId: resolved.share.projectId,
        eventType: "favorite_selected",
        actorType: "customer",
        metadata: { designId: body.designId },
      },
    });
    return Response.json({ ok: true });
  }

  return jsonError("Unsupported action", 400);
}
