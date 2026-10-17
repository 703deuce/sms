import { jsonError, requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";
import { getVisualizerSignedUrl } from "@/lib/visualizer/storage";

type Params = { params: Promise<{ materialId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const { materialId } = await params;
  const prisma = getPrisma();
  const material = await prisma.visualizerMaterial.findFirst({
    where: { id: materialId, workspaceId: auth.workspaceId },
  });
  if (!material) return jsonError("Material not found", 404);

  return Response.json({
    material: {
      ...material,
      imageUrl: await getVisualizerSignedUrl(VISUALIZER_BUCKET, material.imageStoragePath, 7200),
    },
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const { materialId } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const prisma = getPrisma();

  const existing = await prisma.visualizerMaterial.findFirst({
    where: { id: materialId, workspaceId: auth.workspaceId },
  });
  if (!existing) return jsonError("Material not found", 404);

  const material = await prisma.visualizerMaterial.update({
    where: { id: materialId },
    data: {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(typeof body.category === "string" ? { category: body.category.trim() } : {}),
      ...(typeof body.manufacturer === "string" ? { manufacturer: body.manufacturer } : {}),
      ...(typeof body.sku === "string" ? { sku: body.sku } : {}),
      ...(typeof body.finish === "string" ? { finish: body.finish } : {}),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      ...(typeof body.publicVisible === "boolean" ? { publicVisible: body.publicVisible } : {}),
      ...(typeof body.internalNotes === "string" ? { internalNotes: body.internalNotes } : {}),
      ...(typeof body.imageStoragePath === "string"
        ? {
            imageStoragePath: body.imageStoragePath,
            imageMimeType: (body.imageMimeType as string) || existing.imageMimeType,
          }
        : {}),
    },
  });

  return Response.json({ material });
}
