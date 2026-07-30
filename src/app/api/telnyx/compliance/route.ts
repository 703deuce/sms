import { NextResponse } from "next/server";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";
import { getPrisma } from "@/lib/db";
import { getMessagingProvider } from "@/lib/messaging/get-provider";
import { getMessagingProviderName } from "@/lib/messaging/provider-config";
import { getTelnyxPublicKey } from "@/lib/messaging/telnyx/config";

/**
 * Telnyx 10DLC / brand / campaign event notifications.
 * Re-enqueues registration advance for the matching workspace.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new NextResponse("Invalid JSON", { status: 400 });
    }

    const provider = getMessagingProvider();
    const signature =
      request.headers.get("telnyx-signature-ed25519") ||
      request.headers.get("x-telnyx-signature") ||
      request.headers.get("telnyx-signature");
    const timestamp =
      request.headers.get("telnyx-timestamp") || request.headers.get("x-telnyx-timestamp");

    const verified = await provider.verifyWebhook({
      payload: rawBody,
      signature,
      timestamp,
      headers: request.headers,
    });
    if (!verified && (getMessagingProviderName() === "telnyx" || getTelnyxPublicKey())) {
      if (process.env.NODE_ENV === "production" || getTelnyxPublicKey()) {
        return new NextResponse("Invalid signature", { status: 403 });
      }
    }

    const root = (payload || {}) as Record<string, any>;
    const data = root.data || root;
    const eventPayload = data.payload || data;
    const brandId = String(eventPayload.brandId || eventPayload.brand_id || "");
    const campaignId = String(eventPayload.campaignId || eventPayload.campaign_id || "");

    const prisma = getPrisma();
    let reg = null as Awaited<ReturnType<typeof prisma.messagingRegistration.findFirst>>;
    if (brandId) {
      reg = await prisma.messagingRegistration.findFirst({
        where: { OR: [{ brandId }, { brandSid: brandId }] },
      });
    }
    if (!reg && campaignId) {
      reg = await prisma.messagingRegistration.findFirst({
        where: { OR: [{ campaignId }, { a2pCampaignSid: campaignId }] },
      });
    }

    if (reg) {
      await prisma.messagingRegistrationEvent.create({
        data: {
          workspaceId: reg.workspaceId,
          registrationId: reg.id,
          eventType: "telnyx_compliance_webhook",
          message: String(data.event_type || root.event_type || "compliance"),
          payload: root,
        },
      });
      await enqueueMessagingRegistrationAdvance(reg.workspaceId, 2_000);
    }

    return NextResponse.json({ ok: true, matched: Boolean(reg) });
  } catch (err) {
    console.error("[telnyx/compliance]", err);
    return new NextResponse("Compliance webhook failed", { status: 500 });
  }
}
