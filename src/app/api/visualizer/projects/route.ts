import { jsonError, requireSession, resolveWorkspaceId } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { signedAssetUrl } from "@/lib/visualizer/serialize";
import { PROJECT_STATUS_LABELS, TRANSFORMATION_LABELS } from "@/lib/visualizer/constants";

export async function GET(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status")?.trim();
  const contactId = url.searchParams.get("contactId")?.trim();

  const prisma = getPrisma();
  const projects = await prisma.visualizerProject.findMany({
    where: {
      workspaceId: auth.workspaceId,
      archivedAt: null,
      ...(status ? { status: status as never } : {}),
      ...(contactId ? { contactId } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { notes: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: {
      contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
    },
    take: 200,
  });

  const rows = await Promise.all(
    projects.map(async (p) => {
      let thumbUrl: string | null = null;
      if (p.primaryRoomAssetId) {
        const asset = await prisma.visualizerAsset.findUnique({ where: { id: p.primaryRoomAssetId } });
        if (asset) thumbUrl = await signedAssetUrl(asset);
      }
      const designCount = await prisma.visualizerDesign.count({ where: { projectId: p.id } });
      let previewUrl: string | null = null;
      const favorite = await prisma.visualizerDesign.findFirst({
        where: { projectId: p.id, isFavorite: true, generatedAssetId: { not: null } },
        orderBy: { versionNumber: "desc" },
      });
      const latest =
        favorite ||
        (await prisma.visualizerDesign.findFirst({
          where: { projectId: p.id, generatedAssetId: { not: null } },
          orderBy: { versionNumber: "desc" },
        }));
      if (latest?.generatedAssetId) {
        const gen = await prisma.visualizerAsset.findUnique({ where: { id: latest.generatedAssetId } });
        if (gen) previewUrl = await signedAssetUrl(gen);
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
        designCount,
        favoriteDesignId: favorite?.id || latest?.id || null,
        previewUrl,
        updatedAt: p.updatedAt.toISOString(),
        thumbUrl,
      };
    }),
  );

  return Response.json({ projects: rows });
}

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await req.json()) as {
      workspaceId?: string;
      name?: string;
      contactId?: string | null;
      transformation?: string;
      notes?: string;
    };

    let workspaceId: string;
    try {
      workspaceId = await resolveWorkspaceId(auth.session, body.workspaceId);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Forbidden", 403);
    }

    const name = body.name?.trim() || "Bathroom remodel";
    const prisma = getPrisma();
    const project = await prisma.visualizerProject.create({
      data: {
        workspaceId,
        name,
        contactId: body.contactId || null,
        transformation: (body.transformation || "TUB_TO_SHOWER") as never,
        notes: body.notes?.trim() || null,
        source: body.contactId ? "EXISTING_CONTACT" : "INTERNAL",
      },
    });

    return Response.json({ project });
  } catch (e) {
    console.error("[visualizer/projects POST]", e);
    return jsonError(e instanceof Error ? e.message : "Could not create project", 500);
  }
}
