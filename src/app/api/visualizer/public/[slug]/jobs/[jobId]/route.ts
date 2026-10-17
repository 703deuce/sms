import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { signedAssetUrl } from "@/lib/visualizer/serialize";

type Params = { params: Promise<{ slug: string; jobId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { slug, jobId } = await params;
  const prisma = getPrisma();
  const widget = await prisma.visualizerWidgetConfig.findFirst({
    where: { publicSlug: slug, published: true },
  });
  if (!widget) return jsonError("Not found", 404);

  const job = await prisma.visualizerGenerationJob.findFirst({
    where: { id: jobId, workspaceId: widget.workspaceId },
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
      status: job.status,
      errorMessage: job.errorMessage,
      previewUrl,
    },
  });
}
