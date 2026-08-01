import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  listUserDevices,
  registerSoftphoneDevice,
  userHasCallPushReady,
} from "@/lib/phone/device-service";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const devices = await listUserDevices(auth.workspaceId, auth.session.userId);
    const pushReady = await userHasCallPushReady(auth.workspaceId, auth.session.userId);
    return NextResponse.json({ data: { devices, pushReady } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      deviceKey?: string;
      label?: string;
      platform?: string;
      userAgent?: string;
    };
    if (!body.deviceKey?.trim()) {
      return NextResponse.json({ error: "deviceKey required" }, { status: 400 });
    }
    const device = await registerSoftphoneDevice({
      workspaceId: auth.workspaceId,
      userId: auth.session.userId,
      deviceKey: body.deviceKey,
      label: body.label,
      platform: body.platform,
      userAgent: body.userAgent || request.headers.get("user-agent"),
    });
    const pushReady = await userHasCallPushReady(auth.workspaceId, auth.session.userId);
    return NextResponse.json({ data: { device, pushReady } }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
