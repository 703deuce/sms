import { jsonError, requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { signedAssetUrl } from "@/lib/visualizer/serialize";
import { PROJECT_STATUS_LABELS, TRANSFORMATION_LABELS } from "@/lib/visualizer/constants";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const { projectId } = await params;
  const prisma = getPrisma();
  const project = await prisma.visualizerProject.findFirst({
    where: { id: projectId, workspaceId: auth.workspaceId },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      designs: { orderBy: { versionNumber: "asc" } },
    },
  });
  if (!project) return jsonError("Project not found", 404);

  const designs = await Promise.all(
    project.designs.map(async (d) => {
      let previewUrl: string | null = null;
      if (d.generatedAssetId) {
        const asset = await prisma.visualizerAsset.findUnique({ where: { id: d.generatedAssetId } });
        if (asset) previewUrl = await signedAssetUrl(asset);
      }
      return {
        id: d.id,
        versionNumber: d.versionNumber,
        isFavorite: d.isFavorite,
        previewUrl,
        generationJobId: d.generationJobId,
        createdAt: d.createdAt.toISOString(),
      };
    }),
  );

  let beforeUrl: string | null = null;
  if (project.primaryRoomAssetId) {
    const asset = await prisma.visualizerAsset.findUnique({ where: { id: project.primaryRoomAssetId } });
    if (asset) beforeUrl = await signedAssetUrl(asset);
  }

  const events = await prisma.visualizerEvent.findMany({
    where: { workspaceId: auth.workspaceId, projectId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return Response.json({
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      statusLabel: PROJECT_STATUS_LABELS[project.status] || project.status,
      transformation: project.transformation,
      transformationLabel: TRANSFORMATION_LABELS[project.transformation] || project.transformation,
      notes: project.notes,
      contact: project.contact,
      beforeUrl,
      wizardDraftJson: project.wizardDraftJson,
      updatedAt: project.updatedAt.toISOString(),
    },
    designs,
    events: events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      createdAt: e.createdAt.toISOString(),
      metadata: e.metadata,
    })),
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const { projectId } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const prisma = getPrisma();

  const existing = await prisma.visualizerProject.findFirst({
    where: { id: projectId, workspaceId: auth.workspaceId },
  });
  if (!existing) return jsonError("Project not found", 404);

  const project = await prisma.visualizerProject.update({
    where: { id: projectId },
    data: {
      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
      ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
      ...(typeof body.contactId === "string" || body.contactId === null
        ? { contactId: (body.contactId as string) || null }
        : {}),
      ...(typeof body.status === "string" ? { status: body.status as never } : {}),
      ...(body.wizardDraftJson !== undefined ? { wizardDraftJson: body.wizardDraftJson as never } : {}),
      ...(typeof body.primaryRoomAssetId === "string"
        ? { primaryRoomAssetId: body.primaryRoomAssetId }
        : {}),
      ...(typeof body.transformation === "string"
        ? { transformation: body.transformation as never }
        : {}),
    },
  });

  return Response.json({ project });
}
