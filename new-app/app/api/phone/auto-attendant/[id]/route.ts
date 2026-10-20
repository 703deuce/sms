import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { getAutoAttendantMenu, saveAutoAttendantMenu } from "@/lib/server/phone/routing/store";
import { getPrisma } from "@/lib/server/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const data = await getAutoAttendantMenu(workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 404);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const data = await saveAutoAttendantMenu(workspaceId, id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(body.description === null || typeof body.description === "string"
        ? { description: body.description as string | null }
        : {}),
      ...(typeof body.greetingMode === "string" ? { greetingMode: body.greetingMode } : {}),
      ...(body.greetingText === null || typeof body.greetingText === "string"
        ? { greetingText: body.greetingText as string | null }
        : {}),
      ...(body.greetingAudioUrl === null || typeof body.greetingAudioUrl === "string"
        ? { greetingAudioUrl: body.greetingAudioUrl as string | null }
        : {}),
      ...(typeof body.voice === "string" ? { voice: body.voice } : {}),
      ...(typeof body.language === "string" ? { language: body.language } : {}),
      ...(typeof body.inputTimeoutMs === "number" ? { inputTimeoutMs: body.inputTimeoutMs } : {}),
      ...(typeof body.maxRetries === "number" ? { maxRetries: body.maxRetries } : {}),
      ...(body.noInputActionJson !== undefined ? { noInputActionJson: body.noInputActionJson } : {}),
      ...(body.invalidInputActionJson !== undefined
        ? { invalidInputActionJson: body.invalidInputActionJson }
        : {}),
      ...(Array.isArray(body.options) ? { options: body.options as never[] } : {}),
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const assigned = await getPrisma().phoneNumberAnsweringPolicy.count({
      where: { workspaceId, autoAttendantMenuId: id },
    });
    if (assigned > 0) {
      throw new Error("Reassign phone numbers before deleting this menu");
    }
    await getPrisma().autoAttendantMenuOption.deleteMany({ where: { menuId: id } });
    await getPrisma().autoAttendantMenu.deleteMany({ where: { id, workspaceId } });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
