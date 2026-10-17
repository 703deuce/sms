import { jsonError, requireSession, resolveWorkspaceId } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";
import { normalizeVisualizerUploadMime, uploadVisualizerBytes } from "@/lib/visualizer/storage";
import { signedAssetUrl } from "@/lib/visualizer/serialize";

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const form = await req.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") || "").trim() || null;
    const assetType = String(form.get("assetType") || "ORIGINAL_ROOM").trim();
    const workspaceField = String(form.get("workspaceId") || "").trim();

    if (!(file instanceof File)) return jsonError("file required", 400);

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(auth.session, workspaceField || auth.workspaceId);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Forbidden", 403);
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = normalizeVisualizerUploadMime(file.type, file.name);
    const folder =
      assetType === "MATERIAL_REFERENCE"
        ? "materials"
        : assetType === "GENERATED_DESIGN"
          ? "generated"
          : "rooms";

    const uploaded = await uploadVisualizerBytes({
      workspaceId,
      bytes,
      mimeType,
      filename: file.name,
      folder,
    });

    const prisma = getPrisma();
    const asset = await prisma.visualizerAsset.create({
      data: {
        workspaceId,
        projectId,
        assetType: assetType as never,
        storagePath: uploaded.path,
        bucket: uploaded.bucket || VISUALIZER_BUCKET,
        mimeType,
        byteSize: bytes.length,
        originalFilename: file.name,
      },
    });

    if (projectId && assetType === "ORIGINAL_ROOM") {
      await prisma.visualizerProject.updateMany({
        where: { id: projectId, workspaceId },
        data: { primaryRoomAssetId: asset.id },
      });
    }

    const url = await signedAssetUrl(asset);
    return Response.json({
      asset: {
        id: asset.id,
        url,
        storagePath: asset.storagePath,
        bucket: asset.bucket,
        assetType: asset.assetType,
      },
    });
  } catch (e) {
    console.error("[visualizer/upload]", e);
    return jsonError(e instanceof Error ? e.message : "Upload failed", 500);
  }
}
