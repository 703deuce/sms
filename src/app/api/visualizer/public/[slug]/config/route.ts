import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
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
      id: widget.publicMaterialIds.length ? { in: widget.publicMaterialIds } : undefined,
      publicVisible: true,
    },
    take: 24,
  });

  const materialRows = await Promise.all(
    materials.map(async (m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      finish: m.finish,
      imageUrl: await getVisualizerSignedUrl(VISUALIZER_BUCKET, m.imageStoragePath, 3600),
    })),
  );

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
