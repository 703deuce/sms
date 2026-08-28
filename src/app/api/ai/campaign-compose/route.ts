import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { composeCampaignMessages } from "@/lib/ai/campaign-composer";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { isFeatureEnabled } = await import("@/lib/platform-flags");
    if (!(await isFeatureEnabled("ff_ai_templates", true))) {
      return NextResponse.json({ error: "AI templates are disabled for this platform." }, { status: 403 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const prisma = (await import("@/lib/db")).getPrisma();
    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { name: true },
    });
    const data = await composeCampaignMessages({
      goal: String(body.goal || ""),
      audience: String(body.audience || ""),
      tone: String(body.tone || ""),
      offer: String(body.offer || ""),
      businessName: String(body.businessName || workspace?.name || ""),
      includeLink: Boolean(body.includeLink),
      destinationUrl: String(body.destinationUrl || ""),
    });
    return NextResponse.json({
      data: {
        ...data,
        body: data.message,
        alternatives: data.variations,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
