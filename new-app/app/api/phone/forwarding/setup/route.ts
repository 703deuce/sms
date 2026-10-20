import { NextResponse } from "next/server";
import { assertDevApiAccess } from "@/lib/server/dev-api-guard";
import { jsonError } from "@/lib/server/api-error";
import { resolveWorkspaceId } from "@/lib/server/workspace";
import {
  getForwardingSetupDraft,
  saveForwardingSetupDraft,
  upsertAnsweringPolicy,
  createForwardingDestination,
} from "@/lib/server/phone/routing/store";

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId();
    const draft = await getForwardingSetupDraft(workspaceId);
    return NextResponse.json({ data: draft });
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
    const step = typeof body.step === "number" ? body.step : 1;
    const draftJson = body.draftJson ?? body;
    const saved = await saveForwardingSetupDraft(workspaceId, step, draftJson);
    return NextResponse.json({ data: saved });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  const denied = assertDevApiAccess(request);
  if (denied) return denied;
  try {
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as Record<string, unknown>;
    const phoneNumberId = String(body.phoneNumberId || "");
    if (!phoneNumberId) throw new Error("phoneNumberId is required");

    const destinations = Array.isArray(body.destinations) ? body.destinations : [];
    let primaryDestinationId: string | null = null;
    for (const d of destinations) {
      const row = d as Record<string, unknown>;
      const created = await createForwardingDestination(workspaceId, {
        name: String(row.name || "Forward"),
        destinationKind:
          typeof row.destinationKind === "string" ? row.destinationKind : undefined,
        phoneE164:
          typeof row.phoneE164 === "string"
            ? row.phoneE164
            : typeof row.phone === "string"
              ? row.phone
              : undefined,
        workspacePhoneNumberId:
          typeof row.workspacePhoneNumberId === "string"
            ? row.workspacePhoneNumberId
            : undefined,
        press1Required: row.press1Required !== false,
        screeningEnabled: Boolean(row.screeningEnabled ?? row.press1Required !== false),
        hostedE164: typeof body.businessE164 === "string" ? body.businessE164 : undefined,
        hostedPhoneNumberId: phoneNumberId,
      });
      if (!primaryDestinationId) primaryDestinationId = created.id;
    }

    const behavior = String(body.incomingBehavior || "forward");
    let answeringMode = "forward";
    if (behavior === "menu") answeringMode = "auto_attendant";
    if (behavior === "greeting") answeringMode = "greeting_then_forward";

    await upsertAnsweringPolicy(workspaceId, phoneNumberId, {
      answeringMode,
      primaryDestinationId,
      autoAttendantMenuId:
        typeof body.autoAttendantMenuId === "string" ? body.autoAttendantMenuId : null,
      greetingText: typeof body.greetingText === "string" ? body.greetingText : null,
      paused: false,
    });

    return NextResponse.json({ data: { activated: true, primaryDestinationId } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
