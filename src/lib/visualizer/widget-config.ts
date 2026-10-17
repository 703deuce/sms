import "server-only";

import { getPrisma } from "@/lib/db";
import { generatePublicKey } from "@/lib/visualizer/tokens";

export async function ensureVisualizerWidgetConfig(workspaceId: string) {
  const prisma = getPrisma();
  const existing = await prisma.visualizerWidgetConfig.findUnique({
    where: { workspaceId },
  });
  if (existing) return existing;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  });
  if (!workspace?.slug) throw new Error("Workspace slug required for public visualizer.");

  return prisma.visualizerWidgetConfig.create({
    data: {
      workspaceId,
      publicSlug: workspace.slug,
      publicKey: generatePublicKey(),
      published: false,
      brandingJson: {
        headline: "See Your New Bathroom Before You Remodel",
        subtitle:
          "Upload a photo of your existing bathroom, choose a shower style, and preview the transformation.",
        ctaLabel: "Start My Preview",
      },
      limitsJson: {
        perVisitor: 2,
        perDay: 50,
        monthlyBudget: 100,
      },
      leadCaptureJson: {
        captureAfterPreview: true,
        requiredFields: ["fullName", "phone"],
      },
    },
  });
}
