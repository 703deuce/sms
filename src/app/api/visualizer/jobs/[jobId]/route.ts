import { jsonError, requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { signedAssetUrl } from "@/lib/visualizer/serialize";
import { createVisualizerRequestLog, logVisualizerError } from "@/lib/visualizer/server-request-log";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { log, requestId } = createVisualizerRequestLog("jobs");
  const { jobId } = await params;
  log("start", { method: "GET", jobId });
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const prisma = getPrisma();
  const job = await prisma.visualizerGenerationJob.findFirst({
    where: { id: jobId, workspaceId: auth.workspaceId },
  });
  if (!job) return jsonError("Job not found", 404);

  let previewUrl: string | null = null;
  if (job.designId && job.status === "COMPLETED") {
    const design = await prisma.visualizerDesign.findUnique({ where: { id: job.designId } });
    if (design?.generatedAssetId) {
      const asset = await prisma.visualizerAsset.findUnique({ where: { id: design.generatedAssetId } });
      if (asset) previewUrl = await signedAssetUrl(asset);
    }
  }

  log("success", { status: job.status });
  return Response.json({
    requestId,
    job: {
      id: job.id,
      status: job.status,
      errorMessage: job.errorMessage,
      designId: job.designId,
      previewUrl,
      completedAt: job.completedAt?.toISOString() || null,
    },
  });
}
