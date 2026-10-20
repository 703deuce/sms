import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { upsertVoicemailBox } from "@/lib/server/phone/routing/store";
import { getPrisma } from "@/lib/server/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const row = await upsertVoicemailBox(workspaceId, {
      id,
      name: typeof body.name === "string" ? body.name : "Voicemail",
      greetingText: typeof body.greetingText === "string" ? body.greetingText : undefined,
      emailNotify: typeof body.emailNotify === "string" ? body.emailNotify : undefined,
      transcriptionEnabled:
        typeof body.transcriptionEnabled === "boolean" ? body.transcriptionEnabled : undefined,
    });
    return NextResponse.json({ data: row });
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
    await getPrisma().voicemailBox.updateMany({
      where: { id, workspaceId },
      data: { active: false },
    });
    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
