import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const row = await getPrisma().growWidget.updateMany({
      where: { id, workspaceId: auth.workspaceId },
      data: {
        name: body.name as string | undefined,
        status: body.status as string | undefined,
        widgetType: body.widgetType as string | undefined,
        config: body.config as object | undefined,
        linkedFormId: body.linkedFormId as string | undefined,
      },
    });
    return NextResponse.json({ data: { updated: row.count } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
