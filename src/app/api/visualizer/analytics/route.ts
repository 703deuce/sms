import { jsonError, requireSession } from "@/lib/api-auth";
import { getVisualizerOverviewMetrics } from "@/lib/visualizer/service";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const prisma = getPrisma();
  const overview = await getVisualizerOverviewMetrics(auth.workspaceId);
  const projectsCreated = await prisma.visualizerProject.count({
    where: { workspaceId: auth.workspaceId },
  });

  return Response.json({
    metrics: {
      projectsCreated,
      designsCreated: overview.designsCreated,
      designsShared: overview.designsShared,
      estimateRequests: overview.estimateRequests,
    },
  });
}
