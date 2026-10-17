import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapPhoneNumber } from "@/lib/mappers";
import { loadReceptionistWizardPhoneInventory } from "@/lib/phone/receptionist-wizard-phone-inventory";
import {
  VOICE_AGENT_OUTBOUND_SMS_NUMBERS_QUERY,
} from "@/lib/voice/sms/voice-agent-outbound-sms-inventory";

export async function GET(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    if (!auth.workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const eligibleFor = new URL(req.url).searchParams.get("eligibleFor");
    const voiceAgentOutboundSmsOnly =
      eligibleFor === VOICE_AGENT_OUTBOUND_SMS_NUMBERS_QUERY;

    const data = await loadReceptionistWizardPhoneInventory(auth.workspaceId, {
      voiceAgentOutboundSmsOnly,
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error("[api/phone/numbers] GET failed", err);
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      id?: string;
      friendlyName?: string;
      status?: string;
    };
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const existing = await getPrisma().phoneNumber.findFirst({
      where: { id: body.id, workspaceId: auth.workspaceId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const updated = await getPrisma().phoneNumber.update({
      where: { id: body.id },
      data: {
        friendlyName: body.friendlyName ?? undefined,
        status: body.status ?? undefined,
      },
    });
    return NextResponse.json({ data: mapPhoneNumber(updated) });
  } catch (err) {
    return jsonError(err, 400);
  }
}
