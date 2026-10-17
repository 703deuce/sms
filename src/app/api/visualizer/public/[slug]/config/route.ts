import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { listCatalogMaterialsForApi } from "@/lib/visualizer/catalog-materials";
import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";
import { getVisualizerSignedUrl } from "@/lib/visualizer/storage";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;
  const prisma = getPrisma();

  const widget = await prisma.visualizerWidgetConfig.findFirst({
    where: { publicSlug: slug, published: true },
  });
  if (!widget) return jsonError("Visualizer not available", 404);

  const workspace = await prisma.workspace.findUnique({
    where: { id: widget.workspaceId },
    select: { name: true, slug: true },
  });

  const materials = await prisma.visualizerMaterial.findMany({
    where: {
      workspaceId: widget.workspaceId,
      active: true,
      ...(widget.publicMaterialIds.length ? { id: { in: widget.publicMaterialIds } } : {}),
    },
    take: 24,
  });

  const catalogRows = listCatalogMaterialsForApi("WALL_PANEL").map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    finish: m.finish,
    imageUrl: m.imageUrl,
  }));

  const workspaceRows = await Promise.all(
    materials
      .filter((m) => m.publicVisible)
      .map(async (m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        finish: m.finish,
        imageUrl: await getVisualizerSignedUrl(VISUALIZER_BUCKET, m.imageStoragePath, 3600),
      })),
  );

  const materialRows = [...catalogRows, ...workspaceRows];

  return Response.json({
    workspaceName: workspace?.name || slug,
    branding: widget.brandingJson,
    limits: widget.limitsJson,
    leadCapture: widget.leadCaptureJson,
    enabledTransformations: widget.enabledTransformations,
    materials: materialRows,
    publicKey: widget.publicKey,
    workspaceId: widget.workspaceId,
  });
}
