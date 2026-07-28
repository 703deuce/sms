import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getTwilioParentCredentials, isLiveMessagingAdapter } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";
import { appendRegistrationEvent } from "@/lib/messaging/store";

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

async function verify(request: Request, params: Record<string, string>) {
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) {
    if (process.env.NODE_ENV === "production") return false;
    return !isLiveMessagingAdapter();
  }

  const tokens: string[] = [];
  const accountSid = params.AccountSid;
  const bundleSid =
    params.BundleSid || params.CustomerProfileSid || params.TrustProductSid || params.BrandSid || "";

  const prisma = getPrisma();
  const reg = await prisma.messagingRegistration.findFirst({
    where: {
      OR: [
        ...(accountSid ? [{ subaccountSid: accountSid }] : []),
        ...(bundleSid
          ? [
              { secondaryProfileSid: bundleSid },
              { trustProductSid: bundleSid },
              { brandSid: bundleSid },
              { a2pCampaignSid: bundleSid },
            ]
          : []),
      ],
    },
  });
  if (reg?.subaccountAuthTokenEnc) {
    try {
      tokens.push(decryptSecret(reg.subaccountAuthTokenEnc));
    } catch {
      // ignore
    }
  }
  const parent = getTwilioParentCredentials().authToken;
  if (parent) tokens.push(parent);
  if (!tokens.length) return process.env.NODE_ENV !== "production";
  return tokens.some((t) => validateTwilioSignature(t, signature, request.url, params));
}

/**
 * TrustHub / Brand status callbacks from Twilio.
 * Re-enqueues messaging_registration_advance for the matching workspace (wakes deferred jobs).
 */
export async function POST(request: Request) {
  try {
    const payload = await parseBody(request);
    if (!(await verify(request, payload))) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const bundleSid =
      payload.BundleSid ||
      payload.AccountSid ||
      payload.CustomerProfileSid ||
      payload.TrustProductSid ||
      payload.BrandSid ||
      "";

    const prisma = getPrisma();
    const reg = bundleSid
      ? await prisma.messagingRegistration.findFirst({
          where: {
            OR: [
              { secondaryProfileSid: bundleSid },
              { trustProductSid: bundleSid },
              { brandSid: bundleSid },
              { a2pCampaignSid: bundleSid },
              { subaccountSid: bundleSid },
            ],
          },
        })
      : null;

    if (reg) {
      await appendRegistrationEvent({
        workspaceId: reg.workspaceId,
        registrationId: reg.id,
        eventType: "compliance_webhook",
        message: payload.Status || payload.BrandStatus || "update",
        payload,
      });
      await enqueueMessagingRegistrationAdvance(reg.workspaceId, 0);
    }

    return NextResponse.json({ ok: true, matched: Boolean(reg) });
  } catch (err) {
    console.error("[twilio/compliance-status]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
