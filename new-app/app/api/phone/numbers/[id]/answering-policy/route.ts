import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import { getAnsweringPolicyForNumber, upsertAnsweringPolicy } from "@/lib/server/phone/routing/store";
import { getPrisma } from "@/lib/server/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id: phoneNumberId } = await params;
    const number = await getPrisma().phoneNumber.findFirst({
      where: { id: phoneNumberId, workspaceId },
    });
    if (!number) return jsonError(new Error("Number not found"), 404);
    const policy = await getAnsweringPolicyForNumber(workspaceId, phoneNumberId);
    return NextResponse.json({ data: { number, policy } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const { id: phoneNumberId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
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
