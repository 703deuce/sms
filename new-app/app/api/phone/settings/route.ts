import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getPhoneSettings, upsertPhoneSettings } from "@/lib/server/phone/settings";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const data = await getPhoneSettings(workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const data = await upsertPhoneSettings(workspaceId, {
      defaultCallerIdNumber:
        body.defaultCallerIdNumber === null
          ? null
          : typeof body.defaultCallerIdNumber === "string"
            ? body.defaultCallerIdNumber
            : undefined,
      recordCalls: typeof body.recordCalls === "boolean" ? body.recordCalls : undefined,
      transcribeVoicemail:
        typeof body.transcribeVoicemail === "boolean" ? body.transcribeVoicemail : undefined,
      noiseSuppression:
        typeof body.noiseSuppression === "boolean" ? body.noiseSuppression : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
