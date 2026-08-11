import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";
import {
  applyPolicyEvent,
  assertPolicyAllows,
  createInitialLeadPolicy,
} from "@/lib/voice/real-estate/policy";
import { triggerOutboundQualificationCall } from "@/lib/voice/outbound/trigger-qualification-call";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await req.json()) as {
      name?: string;
      phone?: string;
      intent?: "buyer" | "seller";
      source?: string;
      triggerCall?: boolean;
    };
    const name = String(body.name || "Test Lead").trim();
    const phoneRaw = String(body.phone || "").trim();
    if (!phoneRaw) {
      return NextResponse.json({ error: "phone required" }, { status: 400 });
    }
    const phone = normalizeE164(phoneRaw);
    const parts = name.split(/\s+/).filter(Boolean);
    const prisma = getPrisma();
    const config = await loadRealtorProductConfig(auth.workspaceId);

    const contact = await prisma.contact.upsert({
      where: { workspaceId_phone: { workspaceId: auth.workspaceId, phone } },
      create: {
        workspaceId: auth.workspaceId,
        phone,
        firstName: parts[0] || "Test",
        lastName: parts.slice(1).join(" ") || "Lead",
        consentSource: body.source || "test_lead",
      },
      update: {
        firstName: parts[0] || "Test",
        lastName: parts.slice(1).join(" ") || "Lead",
      },
    });

    let outboundCall: Awaited<ReturnType<typeof triggerOutboundQualificationCall>> | null = null;
    const shouldDial =
      body.triggerCall !== false &&
      config.live &&
      config.amyMode !== "front_desk" &&
      config.speedToLead.callImmediately;

    if (shouldDial) {
      const policy = applyPolicyEvent(createInitialLeadPolicy(), { type: "outbound_attempt_queued" });
      assertPolicyAllows(policy, "place_outbound_call");
      outboundCall = await triggerOutboundQualificationCall({
        workspaceId: auth.workspaceId,
        destinationPhone: phone,
        leadName: name,
        contactId: contact.id,
        leadSource: body.source || "realtor_test_lead",
        intent: body.intent || "buyer",
        isTest: true,
        requireTestModeEnv: false,
        triggerSource: "realtor_test_lead",
        triggerReason: "Realtor product test lead",
        submittedFields: { name },
      });
    }

    const call = await prisma.voiceCall.create({
      data: {
        id: createId(),
        workspaceId: auth.workspaceId,
        contactId: contact.id,
        direction: "OUTBOUND",
        status: outboundCall?.status === "dispatching" ? "RINGING" : "QUEUED",
        fromE164: "+10000000000",
        toE164: phone,
        isTest: true,
        metadata: {
          testLead: true,
          leadSource: body.source || "manual_test",
          outboundCallId: outboundCall?.callId,
          realEstateCallState: {
            primaryIntent: body.intent || "buyer",
            secondaryIntents: [],
            callerType: body.intent || "buyer",
            collectedFields: { name },
            leadStatus: "new",
            updatedAt: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      contactId: contact.id,
      callId: call.id,
      outboundCallId: outboundCall?.callId,
      outboundStarted: outboundCall?.status === "dispatching",
      href: `/realtor/leads/${contact.id}`,
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
