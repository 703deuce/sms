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
    const existing = await getPrisma().voiceService.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = (await request.json()) as {
      name?: string;
      durationMinutes?: number;
      bufferMinutes?: number;
      calendarId?: string | null;
      config?: Record<string, unknown>;
    };
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.durationMinutes !== undefined) data.durationMinutes = Number(body.durationMinutes) || 30;
    if (body.bufferMinutes !== undefined) data.bufferMinutes = Number(body.bufferMinutes) || 0;
    if (body.calendarId !== undefined) data.calendarId = body.calendarId || null;
    if (body.config && typeof body.config === "object") {
      data.config = {
        ...((existing.config as Record<string, unknown>) || {}),
        ...body.config,
      };
    }
    const row = await getPrisma().voiceService.update({ where: { id }, data });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const existing = await getPrisma().voiceService.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await getPrisma().voiceService.delete({ where: { id } });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
