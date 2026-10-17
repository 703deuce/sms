import "server-only";

import { getPrisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { generateShareToken, hashShareToken } from "@/lib/visualizer/tokens";
import { VISUALIZER_PUBLIC_ROUTES } from "@/lib/visualizer/routes";

export async function createVisualizerShare(input: {
  workspaceId: string;
  projectId: string;
  designId: string;
  createdByUserId?: string;
  expiresAt?: Date | null;
  allowEstimateRequest?: boolean;
  showMaterials?: boolean;
}) {
  const prisma = getPrisma();
  const design = await prisma.visualizerDesign.findFirst({
    where: { id: input.designId, projectId: input.projectId, workspaceId: input.workspaceId },
  });
  if (!design?.generatedAssetId) {
    throw new Error("Share requires a completed design preview.");
  }

  const widget = await prisma.visualizerWidgetConfig.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const slug =
    widget?.publicSlug ||
    (
      await prisma.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { slug: true },
      })
    )?.slug;
  if (!slug) throw new Error("Workspace public slug is not configured.");

  const token = generateShareToken();
  const share = await prisma.visualizerShare.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      designId: input.designId,
      tokenHash: hashShareToken(token),
      expiresAt: input.expiresAt || null,
      allowEstimateRequest: input.allowEstimateRequest ?? true,
      showMaterials: input.showMaterials ?? true,
      createdByUserId: input.createdByUserId || null,
    },
  });

  await prisma.visualizerProject.update({
    where: { id: input.projectId },
    data: { status: "SHARED" },
  });

  await prisma.visualizerEvent.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      eventType: "design_shared",
      actorType: input.createdByUserId ? "user" : "system",
      actorId: input.createdByUserId || null,
      metadata: { shareId: share.id, designId: input.designId },
    },
  });

  const base = getAppBaseUrl().replace(/\/$/, "");
  const url = `${base}${VISUALIZER_PUBLIC_ROUTES.designShare(slug, token)}`;

  return { shareId: share.id, url, token };
}

export async function resolveShareByToken(slug: string, token: string) {
  const prisma = getPrisma();
  const widget = await prisma.visualizerWidgetConfig.findFirst({
    where: { OR: [{ publicSlug: slug }, { workspace: { slug } }] },
  });
  const workspace =
    widget
      ? await prisma.workspace.findUnique({ where: { id: widget.workspaceId } })
      : await prisma.workspace.findFirst({ where: { slug } });

  if (!workspace) return null;

  const share = await prisma.visualizerShare.findFirst({
    where: {
      workspaceId: workspace.id,
      tokenHash: hashShareToken(token),
      revokedAt: null,
    },
  });
  if (!share) return null;
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) return null;

  return { share, workspace, widget };
}
