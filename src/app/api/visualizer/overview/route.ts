import { jsonError, requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { getVisualizerOverviewMetrics } from "@/lib/visualizer/service";
import { signedAssetUrl } from "@/lib/visualizer/serialize";
import { TRANSFORMATION_LABELS, PROJECT_STATUS_LABELS } from "@/lib/visualizer/constants";
import { createVisualizerRequestLog, logVisualizerError } from "@/lib/visualizer/server-request-log";

export async function GET() {
  const { log, requestId } = createVisualizerRequestLog("overview");
  log("start", { method: "GET" });
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    if (!auth.workspaceId) {
      log("workspace-missing");
      return Response.json({ error: "workspaceId required", requestId }, { status: 400 });
    }

    const workspaceId = auth.workspaceId;
    log("workspace-ok", { workspaceId });
    const metrics = await getVisualizerOverviewMetrics(workspaceId);
    const prisma = getPrisma();

    const projects = await prisma.visualizerProject.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
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
      const latestDesign = await prisma.visualizerDesign.findFirst({
        where: { projectId: p.id, generatedAssetId: { not: null } },
        orderBy: { versionNumber: "desc" },
        select: { generatedAssetId: true },
      });
      try {
        if (latestDesign?.generatedAssetId) {
          const asset = await prisma.visualizerAsset.findUnique({
            where: { id: latestDesign.generatedAssetId },
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

    log("success", { projectCount: recentProjects.length });
    return Response.json({
      requestId,
      metrics,
      recentProjects,
      estimateOpportunities: opportunities.map((o) => ({
        id: o.id,
        projectId: o.projectId,
        projectName: o.project?.name ?? "Project",
        fullName: o.fullName,
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    logVisualizerError("overview", requestId, "failed", e);
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not load overview", requestId },
      { status: 500 },
    );
  }
}
