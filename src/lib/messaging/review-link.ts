import { getPrisma } from "@/lib/db";

/**
 * Resolve the review destination URL for a workspace.
 * Priority: workspace.reviewLinkUrl → messagingSettings.reviewLinkUrl → env fallback.
 */
export async function resolveReviewLink(workspaceId: string): Promise<string> {
  const fallback = process.env.REVIEW_LINK_FALLBACK || "https://transovo.ai";
  try {
    const prisma = getPrisma();
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { reviewLinkUrl: true },
    });
    if (workspace?.reviewLinkUrl?.trim()) return workspace.reviewLinkUrl.trim();

    const settings = await prisma.workspaceMessagingSettings.findUnique({
      where: { workspaceId },
      select: { reviewLinkUrl: true },
    });
    if (settings?.reviewLinkUrl?.trim()) return settings.reviewLinkUrl.trim();
  } catch (err) {
    console.warn("[review-link] resolve failed", workspaceId, err);
  }
  return fallback;
}
