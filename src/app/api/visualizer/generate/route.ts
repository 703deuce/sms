import { jsonError, requireSession, resolveWorkspaceId } from "@/lib/api-auth";
import { startProjectGeneration } from "@/lib/visualizer/service";
import type { SelectedMaterialRef } from "@/lib/visualizer/generation/prompt-builder";

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = (await req.json()) as {
    workspaceId?: string;
    projectId?: string;
    originalRoomAssetId?: string;
    transformation?: string;
    selectedMaterials?: SelectedMaterialRef[];
    instructions?: string;
    parentDesignId?: string;
    referenceAssetIds?: string[];
    idempotencyKey?: string;
  };

  let workspaceId: string;
  try {
    workspaceId = await resolveWorkspaceId(auth.session, body.workspaceId);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Forbidden", 403);
  }

  if (!body.projectId || !body.originalRoomAssetId) {
    return jsonError("projectId and originalRoomAssetId required", 400);
  }

  const idempotencyKey =
    body.idempotencyKey?.trim() ||
    `viz-gen:${body.projectId}:${body.parentDesignId || "root"}:${Date.now()}`;

  try {
    const result = await startProjectGeneration({
      workspaceId,
      projectId: body.projectId,
      transformation: body.transformation || "TUB_TO_SHOWER",
      originalRoomAssetId: body.originalRoomAssetId,
      selectedMaterials: body.selectedMaterials || [],
      instructions: body.instructions,
      parentDesignId: body.parentDesignId,
      referenceAssetIds: body.referenceAssetIds,
      idempotencyKey,
    });
    return Response.json(result);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Generation failed", 400);
  }
}
