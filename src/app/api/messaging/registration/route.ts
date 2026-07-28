import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { messagingOnboarding } from "@/lib/messaging/service";
import { listRegistrationEvents } from "@/lib/messaging/store";
import type { RegistrationAction } from "@/lib/messaging/types";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId") || auth.workspaceId;
    const includeEvents = url.searchParams.get("events") === "1";

    const registration = await messagingOnboarding.get(workspaceId);
    const events = includeEvents ? await listRegistrationEvents(workspaceId) : undefined;
    return NextResponse.json({ data: { registration, events } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as Record<string, unknown>;
    const workspaceId = String(body.workspaceId || auth.workspaceId);
    const action = String(body.action || "") as RegistrationAction;
    if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

    const result = await messagingOnboarding.handleAction(workspaceId, action, body);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
