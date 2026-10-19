import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { getCallRouting, saveCallRouting, getBusinessHours, saveBusinessHours } from "@/lib/server/phone/routing";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    if (url.searchParams.get("part") === "hours") {
      const data = await getBusinessHours(workspaceId);
      return NextResponse.json({ data });
    }
    const data = await getCallRouting(workspaceId);
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
    if (body.businessHoursJson) {
      await saveBusinessHours(workspaceId, {
        timezone: typeof body.timezone === "string" ? body.timezone : undefined,
        businessHoursJson: body.businessHoursJson,
      });
    }
    const data = await saveCallRouting(workspaceId, {
      policy: (body.policy || {}) as Record<string, unknown>,
      greetingText: typeof body.greetingText === "string" ? body.greetingText : body.greetingText === null ? null : undefined,
      greetingUrl: typeof body.greetingUrl === "string" ? body.greetingUrl : body.greetingUrl === null ? null : undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
