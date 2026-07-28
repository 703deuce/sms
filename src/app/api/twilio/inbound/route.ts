import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getTwilioParentCredentials, isLiveMessagingAdapter } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { reconcileCampaignStatus } from "@/lib/campaigns/sequence-runner";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

async function resolveInboundContext(toRaw: string, accountSid?: string) {
  const prisma = getPrisma();
  let to = toRaw;
  try {
    to = normalizeE164(toRaw);
  } catch {
    // keep raw
  }

  const phone = await prisma.phoneNumber.findFirst({
    where: {
      OR: [{ e164: to }, { e164: toRaw }],
      status: "Active",
    },
  });
  if (phone) {
    const reg = await prisma.messagingRegistration.findUnique({ where: { workspaceId: phone.workspaceId } });
    return { workspaceId: phone.workspaceId, phoneE164: phone.e164, registration: reg };
  }

  const reg =
    (await prisma.messagingRegistration.findFirst({
      where: { OR: [{ phoneE164: to }, { phoneE164: toRaw }], phoneAttached: true },
    })) ||
    (accountSid
      ? await prisma.messagingRegistration.findFirst({ where: { subaccountSid: accountSid } })
      : null);

  if (reg?.phoneE164) {
    return { workspaceId: reg.workspaceId, phoneE164: reg.phoneE164, registration: reg };
  }
  return null;
}

async function verifySignature(
  request: Request,
  params: Record<string, string>,
  registration: { subaccountAuthTokenEnc: string | null } | null | undefined,
) {
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) {
    // Unsigned only allowed outside production AND when not live
    if (process.env.NODE_ENV === "production") return false;
    if (isLiveMessagingAdapter()) return false;
    return true;
  }

  const tokens: string[] = [];
  if (registration?.subaccountAuthTokenEnc) {
    try {
      tokens.push(decryptSecret(registration.subaccountAuthTokenEnc));
    } catch {
      // ignore decrypt errors
    }
  }
  const parent = getTwilioParentCredentials().authToken;
  if (parent) tokens.push(parent);

  if (!tokens.length) return process.env.NODE_ENV !== "production";

  return tokens.some((token) => validateTwilioSignature(token, signature, request.url, params));
}

export async function POST(request: Request) {
  try {
    const params = await parseTwilioForm(request);
    const from = params.From ? normalizeE164(params.From) : "";
    const to = params.To || "";
    const body = (params.Body || "").trim();
    const upper = body.toUpperCase();

    const ctx = await resolveInboundContext(to, params.AccountSid);
    if (!(await verifySignature(request, params, ctx?.registration))) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const prisma = getPrisma();

    if (ctx && from && ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(upper)) {
      try {
        const suppressionKey = `${ctx.workspaceId}:p:${from}`;
        try {
          await prisma.suppression.create({
            data: {
              workspaceId: ctx.workspaceId,
              phone: from,
              suppressionKey,
              reason: "STOP",
              source: "inbound_sms",
            },
          });
        } catch (err) {
          if (!(err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002")) {
            throw err;
          }
        }

        await prisma.contact.updateMany({
          where: { workspaceId: ctx.workspaceId, phone: from },
          data: { status: "UNSUBSCRIBED" },
        });

        const recipients = await prisma.campaignRecipient.findMany({
          where: {
            workspaceId: ctx.workspaceId,
            phone: from,
            workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting"] },
          },
        });
        const campaignIds = new Set<string>();
        for (const recipient of recipients) {
          const opted = await prisma.campaignRecipient.updateMany({
            where: {
              id: recipient.id,
              workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting"] },
            },
            data: {
              workflowStatus: "opted_out",
              stopReason: "STOP",
              completedAt: new Date(),
              nextActionAt: null,
              enrollmentKey: null,
            },
          });
          if (opted.count === 1) {
            campaignIds.add(recipient.campaignId);
        await prisma.campaignMessage.updateMany({
          where: { recipientId: recipient.id, status: "queued" },
          data: { status: "skipped", error: "stopped: STOP" },
        });
          }
        }
        for (const campaignId of campaignIds) {
          await prisma.campaign.update({
            where: { id: campaignId },
            data: { optOuts: { increment: 1 } },
          });
          await reconcileCampaignStatus(campaignId);
        }
      } catch (err) {
        // Return 5xx so Twilio retries — never silently drop STOP
        console.error("[twilio/inbound] STOP persistence failed", err);
        return new NextResponse("STOP processing failed", { status: 500 });
      }

      const stopMsg =
        ctx.registration?.stopMessage ||
        "You are unsubscribed and will no longer receive messages. Reply START to re-subscribe.";
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(stopMsg)}</Message></Response>`;
      return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (ctx && from && ["START", "YES", "UNSTOP"].includes(upper)) {
      await prisma.suppression.deleteMany({
        where: { workspaceId: ctx.workspaceId, phone: from },
      });
      await prisma.contact.updateMany({
        where: { workspaceId: ctx.workspaceId, phone: from },
        data: { status: "SUBSCRIBED" },
      });
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>You have been re-subscribed. Reply STOP to opt out.</Message></Response>`;
      return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (ctx && from && ["HELP", "INFO"].includes(upper)) {
      const help =
        ctx.registration?.helpMessage ||
        `${ctx.registration?.legalBusinessName || "Support"}: For help contact ${ctx.registration?.contactEmail || "support"}. Reply STOP to opt out. Msg&data rates may apply.`;
      const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(help)}</Message></Response>`;
      return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    if (ctx && from) {
      let contact = await prisma.contact.findUnique({
        where: { workspaceId_phone: { workspaceId: ctx.workspaceId, phone: from } },
      });
      if (!contact) {
        contact = await prisma.contact.create({
          data: { workspaceId: ctx.workspaceId, phone: from, lastReply: new Date() },
        });
      } else {
        await prisma.contact.update({
          where: { id: contact.id },
          data: { lastReply: new Date() },
        });
      }

      let conversation = await prisma.conversation.findFirst({
        where: { workspaceId: ctx.workspaceId, contactId: contact.id, status: { not: "CLOSED" } },
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { workspaceId: ctx.workspaceId, contactId: contact.id, status: "OPEN", unread: true },
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

      const active = await prisma.campaignRecipient.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          phone: from,
          workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting"] },
        },
      });
      const repliedCampaignIds = new Set<string>();
      for (const r of active) {
        await prisma.$transaction(async (tx) => {
          const row = await tx.campaignRecipient.findUnique({ where: { id: r.id } });
          if (!row) return;
          const prev =
            row.metadata && typeof row.metadata === "object"
              ? (row.metadata as Record<string, unknown>)
              : {};
          if (prev.customer_replied) return;
          await tx.campaignRecipient.update({
            where: { id: r.id },
            data: { metadata: { ...prev, customer_replied: true } },
          });
          repliedCampaignIds.add(r.campaignId);
        });
      }
      for (const campaignId of repliedCampaignIds) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { replies: { increment: 1 } },
        });
      }
    }

    return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("[twilio/inbound]", err);
    // Non-STOP failures: 500 so Twilio retries (better than silent drop)
    return new NextResponse("Inbound processing failed", { status: 500 });
  }
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
