import { NextResponse } from "next/server";
import { handleTwilioTfvWebhook } from "@/lib/mctb/tfv/service";
import { getTwilioParentCredentials, isLiveMessagingAdapter } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const params: Record<string, string> = {};
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    for (const [k, v] of Object.entries(json)) {
      if (v != null) params[k] = String(v);
    }
  } else {
    const form = await request.formData();
    form.forEach((value, key) => {
      params[key] = String(value);
    });
  }
  return params;
}

/**
 * Twilio toll-free verification status callbacks.
 * Distinct from TrustHub/A2P compliance-status webhook.
 */
export async function POST(request: Request) {
  try {
    const payload = await parseBody(request);
    const signature = request.headers.get("x-twilio-signature") || "";
    const token = getTwilioParentCredentials().authToken;
    const live = isLiveMessagingAdapter();

    if (live) {
      if (!token) {
        return new NextResponse("Twilio auth not configured", { status: 500 });
      }
      if (!signature || !validateTwilioSignature(token, signature, request.url, payload)) {
        return new NextResponse("Invalid signature", { status: 403 });
      }
    } else if (signature && token && !validateTwilioSignature(token, signature, request.url, payload)) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const result = await handleTwilioTfvWebhook({
      verificationSid: payload.VerificationSid || payload.Sid || payload.ResourceSid,
      status: payload.Status || payload.VerificationStatus,
      externalReferenceId: payload.ExternalReferenceId,
      tollfreePhoneNumberSid: payload.TollfreePhoneNumberSid || payload.PhoneNumberSid,
      rejectionReason:
        payload.RejectionReason ||
        payload.EditReason ||
        payload.RejectionReasons ||
        payload.ErrorMessage,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[twilio/toll-free-verification]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
