import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { jobId } = await context.params;
    const prisma = getPrisma();
    const job = await prisma.voiceWebsiteCrawlJob.findFirst({
      where: { id: jobId, workspaceId: auth.workspaceId },
      include: {
        pages: {
          orderBy: { sourceUrl: "asc" },
          take: 200,
          select: {
            id: true,
            sourceUrl: true,
            pageTitle: true,
            status: true,
            lastIndexedAt: true,
            skipReason: true,
            errorMessage: true,
          },
        },
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ data: job });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { jobId } = await context.params;
    const body = (await request.json()) as { dismissKey?: string };
    const dismissKey = String(body.dismissKey || "").trim();
    if (!dismissKey) {
      return NextResponse.json({ error: "dismissKey is required" }, { status: 400 });
    }
    const prisma = getPrisma();
    const job = await prisma.voiceWebsiteCrawlJob.findFirst({
      where: { id: jobId, workspaceId: auth.workspaceId },
      select: { id: true, suggestions: true },
    });
    if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { mergeDismissedIntoSuggestions } = await import(
      "@/lib/voice/knowledge/website-crawl-customer-status"
    );
    const next = mergeDismissedIntoSuggestions(job.suggestions, dismissKey);
    await prisma.voiceWebsiteCrawlJob.update({
      where: { id: job.id },
      data: { suggestions: next },
    });
    return NextResponse.json({ ok: true, suggestions: next });
  } catch (err) {
    return jsonError(err, 500);
  }
}
