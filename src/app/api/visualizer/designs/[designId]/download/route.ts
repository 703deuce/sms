import { jsonError, requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { downloadVisualizerObject } from "@/lib/visualizer/storage";

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
  if (!design?.generatedAssetId) {
    return jsonError("Preview image not ready", 404);
  }

  const asset = await prisma.visualizerAsset.findFirst({
    where: { id: design.generatedAssetId, workspaceId: auth.workspaceId },
  });
  if (!asset) return jsonError("Asset not found", 404);

  const bytes = await downloadVisualizerObject(asset.bucket, asset.storagePath);
  const ext = asset.mimeType.includes("jpeg") || asset.mimeType.includes("jpg") ? "jpg" : "png";
  const filename = `bathroom-remodel-preview-v${design.versionNumber}.${ext}`;

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
