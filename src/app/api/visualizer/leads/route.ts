import { jsonError, requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const prisma = getPrisma();
  const leads = await prisma.visualizerEstimateRequest.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return Response.json({
    leads: leads.map((l) => ({
      id: l.id,
      fullName: l.fullName,
      phone: l.phone,
      status: l.status,
      projectId: l.projectId,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
