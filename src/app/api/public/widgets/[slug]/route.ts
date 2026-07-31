import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const widget = await getPrisma().growWidget.findFirst({
      where: { slug, status: "active" },
    });
    if (!widget) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await getPrisma().growWidget.update({
      where: { id: widget.id },
      data: { views: { increment: 1 } },
    });

    let linkedFormSlug: string | null = null;
    if (widget.linkedFormId) {
      const form = await getPrisma().optInForm.findFirst({
        where: { id: widget.linkedFormId, workspaceId: widget.workspaceId },
        select: { slug: true },
      });
      linkedFormSlug = form?.slug ?? null;
    }

    return NextResponse.json({
      data: {
        id: widget.id,
        name: widget.name,
        widgetType: widget.widgetType,
        config: widget.config,
        linkedFormId: widget.linkedFormId,
        linkedFormSlug,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
