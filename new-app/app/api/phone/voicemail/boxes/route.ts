import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { listVoicemailBoxes, upsertVoicemailBox } from "@/lib/server/phone/routing/store";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await listVoicemailBoxes(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const row = await upsertVoicemailBox(workspaceId, {
      name: String(body.name || "Voicemail"),
      greetingText: typeof body.greetingText === "string" ? body.greetingText : undefined,
      emailNotify: typeof body.emailNotify === "string" ? body.emailNotify : undefined,
      phoneNumberId: typeof body.phoneNumberId === "string" ? body.phoneNumberId : undefined,
      transcriptionEnabled:
        typeof body.transcriptionEnabled === "boolean" ? body.transcriptionEnabled : undefined,
    });
    return NextResponse.json({ data: row });
  } catch (err) {
    return jsonError(err, 400);
  }
}
