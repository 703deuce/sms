import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { uploadVisualizerBytes } from "@/lib/visualizer/storage";
import { startProjectGeneration } from "@/lib/visualizer/service";
import { hashShareToken } from "@/lib/visualizer/tokens";
import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";

type Params = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Params) {
  const { slug } = await params;
  const prisma = getPrisma();
  const widget = await prisma.visualizerWidgetConfig.findFirst({
    where: { publicSlug: slug, published: true },
  });
  if (!widget) return jsonError("Visualizer not available", 404);

  const limits = (widget.limitsJson as { perDay?: number; monthlyBudget?: number }) || {};
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const usedToday = await prisma.visualizerGenerationJob.count({
    where: { workspaceId: widget.workspaceId, createdAt: { gte: dayStart } },
  });
  if (limits.perDay && usedToday >= limits.perDay) {
    return jsonError("Daily preview limit reached. Please try again tomorrow.", 429);
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const usedMonth = await prisma.visualizerUsageLedger.aggregate({
    where: { workspaceId: widget.workspaceId, createdAt: { gte: monthStart } },
    _sum: { credits: true },
  });
  const monthlyBudget = limits.monthlyBudget ?? 100;
  if ((usedMonth._sum.credits || 0) >= monthlyBudget) {
    return jsonError("Monthly preview allowance reached.", 429);
  }

  const form = await req.formData();
  const file = form.get("file");
  const transformation = String(form.get("transformation") || "TUB_TO_SHOWER");
  const materialId = String(form.get("materialId") || "").trim();
  const visitorKey = String(form.get("visitorKey") || "").trim();

  if (!(file instanceof File)) return jsonError("file required", 400);
  const perVisitor = (limits as { perVisitor?: number }).perVisitor ?? 2;
  if (visitorKey && perVisitor > 0) {
    const recent = await prisma.visualizerEvent.findMany({
      where: {
        workspaceId: widget.workspaceId,
        eventType: "public_generation",
        createdAt: { gte: new Date(Date.now() - 7 * 86400_000) },
      },
      select: { metadata: true },
      take: 500,
    });
    const visitorJobs = recent.filter(
      (e) => (e.metadata as { visitorKey?: string } | null)?.visitorKey === visitorKey,
    ).length;
    if (visitorJobs >= perVisitor) {
      return jsonError("Preview limit reached for this visit.", 429);
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadVisualizerBytes({
    workspaceId: widget.workspaceId,
    bytes,
    mimeType: file.type || "image/jpeg",
    filename: file.name,
    folder: "rooms",
  });

  const project = await prisma.visualizerProject.create({
    data: {
      workspaceId: widget.workspaceId,
      name: "Website preview",
      transformation: transformation as never,
      source: "HOSTED_PAGE",
      status: "DRAFT",
    },
  });

  const roomAsset = await prisma.visualizerAsset.create({
    data: {
      workspaceId: widget.workspaceId,
      projectId: project.id,
      assetType: "ORIGINAL_ROOM",
      storagePath: uploaded.path,
      bucket: uploaded.bucket || VISUALIZER_BUCKET,
      mimeType: file.type || "image/jpeg",
      byteSize: bytes.length,
      originalFilename: file.name,
    },
  });

  await prisma.visualizerProject.update({
    where: { id: project.id },
    data: { primaryRoomAssetId: roomAsset.id },
  });

  const selectedMaterials = materialId
    ? [{ materialId, category: "WALL_PANEL" }]
    : [];

  const idempotencyKey = `public:${slug}:${hashShareToken(visitorKey || String(Date.now()))}:${project.id}`;

  const { designId, generationJobId } = await startProjectGeneration({
    workspaceId: widget.workspaceId,
    projectId: project.id,
    transformation,
    originalRoomAssetId: roomAsset.id,
    selectedMaterials,
    idempotencyKey,
  });

  await prisma.visualizerEvent.create({
    data: {
      workspaceId: widget.workspaceId,
      projectId: project.id,
      eventType: "public_generation",
      actorType: "visitor",
      metadata: { visitorKey, designId, generationJobId },
    },
  });

  return Response.json({ projectId: project.id, designId, generationJobId });
}
