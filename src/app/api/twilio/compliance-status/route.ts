import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";
import { appendRegistrationEvent } from "@/lib/messaging/store";

/**
 * TrustHub / Brand status callbacks from Twilio.
 * Re-enqueues messaging_registration_advance for the matching workspace (wakes deferred jobs).
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let payload: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      payload = (await request.json()) as Record<string, string>;
    } else {
      const form = await request.formData();
      form.forEach((value, key) => {
        payload[key] = String(value);
      });
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
      // wake=true via deferMs=0 in enqueueMessagingRegistrationAdvance
      await enqueueMessagingRegistrationAdvance(reg.workspaceId, 0);
    }

    return NextResponse.json({ ok: true, matched: Boolean(reg) });
  } catch (err) {
    console.error("[twilio/compliance-status]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
