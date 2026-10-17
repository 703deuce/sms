import { jsonError, requireSession, resolveWorkspaceId } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { VISUALIZER_BUCKET } from "@/lib/visualizer/constants";
import { getVisualizerSignedUrl } from "@/lib/visualizer/storage";

export async function GET(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const url = new URL(req.url);
  const category = url.searchParams.get("category")?.trim();
  const activeOnly = url.searchParams.get("active") !== "0";

  const prisma = getPrisma();
  const materials = await prisma.visualizerMaterial.findMany({
    where: {
      workspaceId: auth.workspaceId,
      ...(category ? { category } : {}),
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows = await Promise.all(
    materials.map(async (m) => ({
      id: m.id,
      name: m.name,
      category: m.category,
      manufacturer: m.manufacturer,
      sku: m.sku,
      finish: m.finish,
      active: m.active,
      publicVisible: m.publicVisible,
      imageUrl: await getVisualizerSignedUrl(VISUALIZER_BUCKET, m.imageStoragePath, 7200),
      updatedAt: m.updatedAt.toISOString(),
    })),
  );

  return Response.json({ materials: rows });
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = (await req.json()) as {
    workspaceId?: string;
    name?: string;
    category?: string;
    manufacturer?: string;
    sku?: string;
    finish?: string;
    description?: string;
    imageStoragePath?: string;
    imageMimeType?: string;
    publicVisible?: boolean;
    internalNotes?: string;
  };

  let workspaceId: string;
  try {
    workspaceId = await resolveWorkspaceId(auth.session, body.workspaceId);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Forbidden", 403);
  }

  if (!body.name?.trim() || !body.category?.trim() || !body.imageStoragePath) {
    return jsonError("name, category, and imageStoragePath required", 400);
  }

  const prisma = getPrisma();
  const material = await prisma.visualizerMaterial.create({
    data: {
      workspaceId,
      name: body.name.trim(),
      category: body.category.trim(),
      manufacturer: body.manufacturer?.trim() || null,
      sku: body.sku?.trim() || null,
      finish: body.finish?.trim() || null,
      description: body.description?.trim() || null,
      imageStoragePath: body.imageStoragePath,
      imageMimeType: body.imageMimeType || "image/jpeg",
      publicVisible: body.publicVisible ?? false,
      internalNotes: body.internalNotes?.trim() || null,
    },
  });

  return Response.json({ material });
}
