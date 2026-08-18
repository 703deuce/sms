import { NextResponse } from "next/server";
import {
  buildTwilioDialStatusTwiml,
  buildTwilioInboundTwiml,
} from "@/lib/numbers/providers/voice/twilio-personal-voice";
import { startTwilioSmartRoutingTestCall } from "@/lib/smart-routing/twilio-webhook-handler";
import { verifyTwilioVoiceWebhookSignature } from "@/lib/numbers/providers/voice/twilio-voice-webhook-auth";
import { getPrisma } from "@/lib/db";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

function twimlResponse(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: Request) {
  const params = await parseTwilioForm(request);
  if (!(await verifyTwilioVoiceWebhookSignature(request, params, params.To))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const callSid = params.CallSid || "";
  const from = params.From || "";
  const to = params.To || "";
  const dialStatus = params.DialCallStatus;
  const url = new URL(request.url);
  const humanCallId = url.searchParams.get("humanCallId");
  const srTestFlowId = url.searchParams.get("srTestFlowId");

  if (dialStatus && humanCallId) {
    const xml = await buildTwilioDialStatusTwiml({
      dialCallStatus: dialStatus,
      humanCallId,
    });
    return twimlResponse(xml);
  }

  if (srTestFlowId && callSid) {
    const prisma = getPrisma();
    const flow = await prisma.smartRoutingFlow.findFirst({
      where: { id: srTestFlowId },
      select: { workspaceId: true },
    });
    if (flow) {
      const result = await startTwilioSmartRoutingTestCall({
        workspaceId: flow.workspaceId,
        flowId: srTestFlowId,
        callSid,
        businessE164: from,
        testUserE164: to,
      });
      return twimlResponse(result.twiml);
    }
  }

  const xml = await buildTwilioInboundTwiml({ callSid, from, to });
  return twimlResponse(xml);
}
