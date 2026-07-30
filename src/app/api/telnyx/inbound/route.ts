import { NextResponse } from "next/server";
import { getMessagingProvider } from "@/lib/messaging/get-provider";
import { processInboundMessage, resolveInboundContext } from "@/lib/messaging/inbound-process";
import { getTelnyxPublicKey } from "@/lib/messaging/telnyx/config";
import { getMessagingProviderName } from "@/lib/messaging/provider-config";

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

    // Fail closed when Telnyx is live and a public key is configured.
    if (!verified && (getMessagingProviderName() === "telnyx" || getTelnyxPublicKey())) {
      if (process.env.NODE_ENV === "production" || getTelnyxPublicKey()) {
        return new NextResponse("Invalid signature", { status: 403 });
      }
    }

    const parsed = provider.parseInboundMessage(payload);
    if (!parsed.to) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const root = payload as { data?: { payload?: { messaging_profile_id?: string } } };
    const profileId = root?.data?.payload?.messaging_profile_id;
    const ctx = await resolveInboundContext(parsed.to, profileId);
    if (!ctx) {
      return NextResponse.json({ ok: true, unmatched: true });
    }

    try {
      const result = await processInboundMessage({
        workspaceId: ctx.workspaceId,
        from: parsed.from,
        to: parsed.to,
        body: parsed.body,
        providerMessageId: parsed.providerMessageId,
        registration: ctx.registration,
      });

      // Telnyx auto-responds via messaging profile keywords for STOP/HELP in many setups.
      // We still return 200 quickly; optional explicit reply can be added later.
      return NextResponse.json({
        ok: true,
        kind: result.kind,
        reply: result.replyText || null,
      });
    } catch (err) {
      if (parsed.body?.toUpperCase().match(/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/)) {
        console.error("[telnyx/inbound] STOP persistence failed", err);
        return new NextResponse("STOP processing failed", { status: 500 });
      }
      throw err;
    }
  } catch (err) {
    console.error("[telnyx/inbound]", err);
    return new NextResponse("Inbound processing failed", { status: 500 });
  }
}
