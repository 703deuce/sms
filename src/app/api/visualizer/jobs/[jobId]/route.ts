import { jsonError, requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { signedAssetUrl } from "@/lib/visualizer/serialize";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const { jobId } = await params;
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

  return Response.json({
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
