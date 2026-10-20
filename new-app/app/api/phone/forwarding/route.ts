import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { getForwardingConfig, upsertAnsweringPolicy } from "@/lib/server/phone/routing/store";
import { getPrisma } from "@/lib/server/db";

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const url = new URL(request.url);
    const phoneNumberId = url.searchParams.get("phoneNumberId");
    const data = await getForwardingConfig(workspaceId);
    let policy = null;
    if (phoneNumberId) {
      policy = data.policies.find((p) => p.phoneNumberId === phoneNumberId) ?? null;
    }
    const numbers = await getPrisma().phoneNumber.findMany({
      where: { workspaceId, status: "Active" },
      select: { id: true, e164: true, friendlyName: true, settingsJson: true },
      orderBy: { e164: "asc" },
    });
    return NextResponse.json({ data: { ...data, policy, numbers } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const phoneNumberId = String(body.phoneNumberId || "");
    if (!phoneNumberId) throw new Error("phoneNumberId is required");
    const policy = await upsertAnsweringPolicy(workspaceId, phoneNumberId, {
      answeringMode: typeof body.answeringMode === "string" ? body.answeringMode : undefined,
      forwardingGroupId:
        body.forwardingGroupId === null
          ? null
          : typeof body.forwardingGroupId === "string"
            ? body.forwardingGroupId
            : undefined,
      primaryDestinationId:
        body.primaryDestinationId === null
          ? null
          : typeof body.primaryDestinationId === "string"
            ? body.primaryDestinationId
            : undefined,
      autoAttendantMenuId:
        body.autoAttendantMenuId === null
          ? null
          : typeof body.autoAttendantMenuId === "string"
            ? body.autoAttendantMenuId
            : undefined,
      paused: typeof body.paused === "boolean" ? body.paused : undefined,
      greetingBeforeForward:
        typeof body.greetingBeforeForward === "boolean" ? body.greetingBeforeForward : undefined,
      greetingText:
        body.greetingText === null
          ? null
          : typeof body.greetingText === "string"
            ? body.greetingText
            : undefined,
      scheduleJson: body.scheduleJson,
      holidayExceptionsJson: body.holidayExceptionsJson,
    });
    return NextResponse.json({ data: policy });
  } catch (err) {
    return jsonError(err, 400);
  }
}
