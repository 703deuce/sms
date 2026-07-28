import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getTwilioParentCredentials } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

function verifyOptional(request: Request, params: Record<string, string>) {
  const { authToken } = getTwilioParentCredentials();
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!authToken || !signature) return true; // allow in mock/dev
  return validateTwilioSignature(authToken, signature, request.url, params);
}

export async function POST(request: Request) {
  try {
    const params = await parseTwilioForm(request);
    if (!verifyOptional(request, params)) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const from = params.From ? normalizeE164(params.From) : "";
    const to = params.To || "";
    const body = (params.Body || "").trim();
    const upper = body.toUpperCase();

    const prisma = getPrisma();
    const phone = await prisma.phoneNumber.findFirst({
      where: { e164: to, status: "Active" },
    });

    // STOP / START / HELP keywords
    if (phone && from && ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(upper)) {
      const existing = await prisma.suppression.findFirst({
        where: { workspaceId: phone.workspaceId, phone: from },
      });
      if (!existing) {
        await prisma.suppression.create({
          data: {
            workspaceId: phone.workspaceId,
            phone: from,
            reason: "STOP",
            source: "inbound_sms",
          },
        });
      }

      await prisma.contact.updateMany({
        where: { workspaceId: phone.workspaceId, phone: from },
        data: { status: "UNSUBSCRIBED" },
      });

      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You are unsubscribed and will no longer receive messages. Reply START to re-subscribe.</Message></Response>`;
      return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (phone && from && ["START", "YES", "UNSTOP"].includes(upper)) {
      await prisma.suppression.deleteMany({
        where: { workspaceId: phone.workspaceId, phone: from },
      });
      await prisma.contact.updateMany({
        where: { workspaceId: phone.workspaceId, phone: from },
        data: { status: "SUBSCRIBED" },
      });
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been re-subscribed. Reply STOP to opt out.</Message></Response>`;
      return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (phone && from) {
      // Attach inbound to inbox conversation when possible
      let contact = await prisma.contact.findUnique({
        where: { workspaceId_phone: { workspaceId: phone.workspaceId, phone: from } },
      });
      if (!contact) {
        contact = await prisma.contact.create({
          data: { workspaceId: phone.workspaceId, phone: from, lastReply: new Date() },
        });
      } else {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { lastReply: new Date() },
        });
      }

      let conversation = await prisma.conversation.findFirst({
        where: { workspaceId: phone.workspaceId, contactId: contact.id, status: { not: "CLOSED" } },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { workspaceId: phone.workspaceId, contactId: contact.id, status: "OPEN", unread: true },
        });
      } else {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { unread: true, updatedAt: new Date() },
        });
      }

      await prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          direction: "inbound",
          body: body || "(empty)",
        },
      });
    }

    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("[twilio/inbound]", err);
    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  }
}
