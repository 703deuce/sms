import { jsonError, requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getVisualizerOverviewMetrics } from "@/lib/visualizer/service";
import { signedAssetUrl } from "@/lib/visualizer/serialize";
import { TRANSFORMATION_LABELS, PROJECT_STATUS_LABELS } from "@/lib/visualizer/constants";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    if (!auth.workspaceId) return jsonError("workspaceId required", 400);

    const workspaceId = auth.workspaceId;
    const metrics = await getVisualizerOverviewMetrics(workspaceId);
    const prisma = getPrisma();

    const projects = await prisma.visualizerProject.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        designs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });

    const opportunities = await prisma.visualizerEstimateRequest.findMany({
      where: { workspaceId, status: { in: ["NEW", "CONTACT_NEEDED"] } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    const recentProjects = await Promise.all(
      projects.map(async (p) => {
      let thumbUrl: string | null = null;
      const design = p.designs[0];
      try {
        if (design?.generatedAssetId) {
          const asset = await prisma.visualizerAsset.findUnique({
            where: { id: design.generatedAssetId },
          });
          if (asset) thumbUrl = await signedAssetUrl(asset);
        } else if (p.primaryRoomAssetId) {
          const asset = await prisma.visualizerAsset.findUnique({
            where: { id: p.primaryRoomAssetId },
          });
          if (asset) thumbUrl = await signedAssetUrl(asset);
        }
      } catch (thumbErr) {
        console.warn("[visualizer/overview] thumb sign failed", p.id, thumbErr);
      }
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          statusLabel: PROJECT_STATUS_LABELS[p.status] || p.status,
          transformation: p.transformation,
          transformationLabel: TRANSFORMATION_LABELS[p.transformation] || p.transformation,
          contact: p.contact
            ? {
                id: p.contact.id,
                name: [p.contact.firstName, p.contact.lastName].filter(Boolean).join(" ") || p.contact.phone,
              }
            : null,
          updatedAt: p.updatedAt.toISOString(),
          thumbUrl,
          designCount: await prisma.visualizerDesign.count({ where: { projectId: p.id } }),
        };
      }),
    );

    return Response.json({
      metrics,
      recentProjects,
      estimateOpportunities: opportunities.map((o) => ({
        id: o.id,
        projectId: o.projectId,
        projectName: o.project.name,
        fullName: o.fullName,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("[visualizer/overview]", e);
    return jsonError(e instanceof Error ? e.message : "Could not load overview", 500);
  }
}
