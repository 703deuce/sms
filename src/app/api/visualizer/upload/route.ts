import { jsonError, requireSession, resolveWorkspaceId } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";
import { createVisualizerRequestLog, logVisualizerError } from "@/lib/visualizer/server-request-log";
import { normalizeVisualizerUploadMime, uploadVisualizerBytes } from "@/lib/visualizer/storage";
import { signedAssetUrl } from "@/lib/visualizer/serialize";

export async function POST(req: Request) {
  const { log, requestId } = createVisualizerRequestLog("upload");
  log("start", { method: "POST" });

  try {
    const auth = await requireSession();
    if ("error" in auth) {
      log("auth-denied");
      return auth.error;
    }
    log("auth-ok", { workspaceId: auth.workspaceId || "(none)" });

    const form = await req.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") || "").trim() || null;
    const assetType = String(form.get("assetType") || "ORIGINAL_ROOM").trim();
    const workspaceField = String(form.get("workspaceId") || "").trim();

    if (!(file instanceof File)) {
      log("validation-failed", { reason: "file missing" });
      return jsonError("file required", 400);
    }

    log("file-received", {
      name: file.name,
      type: file.type || "(empty)",
      size: file.size,
      projectId,
      assetType,
    });

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(auth.session, workspaceField || auth.workspaceId);
    } catch (e) {
      logVisualizerError("upload", requestId, "resolve-workspace", e);
      return Response.json(
        { error: e instanceof Error ? e.message : "Forbidden", requestId },
        { status: 403 },
      );
    }
    log("workspace-resolved", { workspaceId });

    const bytes = Buffer.from(await file.arrayBuffer());
    const mimeType = normalizeVisualizerUploadMime(file.type, file.name);
    log("mime-normalized", { mimeType });

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
    log("storage-uploaded", { path: uploaded.path, bucket: uploaded.bucket });

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
    log("asset-created", { assetId: asset.id });

    if (projectId && assetType === "ORIGINAL_ROOM") {
      await prisma.visualizerProject.updateMany({
        where: { id: projectId, workspaceId },
        data: { primaryRoomAssetId: asset.id },
      });
      log("project-primary-room-updated", { projectId });
    }

    const url = await signedAssetUrl(asset);
    log("success", { assetId: asset.id });
    return Response.json({
      requestId,
      asset: {
        id: asset.id,
        url,
        storagePath: asset.storagePath,
        bucket: asset.bucket,
        assetType: asset.assetType,
      },
    });
  } catch (e) {
    logVisualizerError("upload", requestId, "failed", e);
    const message = e instanceof Error ? e.message : "Upload failed";
    return Response.json({ error: message, requestId }, { status: 500 });
  }
}
