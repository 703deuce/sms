#!/usr/bin/env npx tsx
import { getPrisma } from "@/lib/db";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { HP_CERTIFIED_SMS_E164 } from "@/lib/messaging/preferred-sending-number";
import { telnyxProvider } from "@/lib/messaging/telnyx/provider";
import {
  resolveMctbMessageTemplate,
  renderMctbMessageTemplate,
} from "@/lib/mctb/message-template";
import { resolveMctbTemplateVars } from "@/lib/mctb/template-vars";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const phone = process.argv[2] || "5714776175";
const digits = phone.replace(/\D/g, "");
const to = digits.length === 10 ? `+1${digits}` : `+${digits}`;
const eventId = process.argv[3] || "cmu0njhb13q3f5c3u266e5d0q";

async function main() {
  process.env.MESSAGING_PROVIDER = "telnyx";
  const prisma = getPrisma();
  const mctb = await loadMissedCallTextConfig(WORKSPACE_ID);
  const contact = await prisma.contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, phone: to },
  });
  const templateVars = resolveMctbTemplateVars({
    config: mctb,
    callerE164: to,
    contact,
    missedCallEventId: eventId,
  });
  const body = renderMctbMessageTemplate(resolveMctbMessageTemplate(mctb), templateVars);
  console.log("Sending opener to", to, "from", HP_CERTIFIED_SMS_E164);
  console.log("Body:", body);
  const result = await telnyxProvider.sendMessage(
    { phoneE164: HP_CERTIFIED_SMS_E164, messagingProvider: "telnyx" } as import("@prisma/client").MessagingRegistration,
    { to, from: HP_CERTIFIED_SMS_E164, body },
  );
  console.log("Telnyx result:", result);
  await prisma.message.create({
    data: {
      workspaceId: WORKSPACE_ID,
      conversationId: (
        await prisma.conversation.findFirst({
          where: { workspaceId: WORKSPACE_ID, contact: { phone: to } },
          orderBy: { updatedAt: "desc" },
        })
      )?.id || (await prisma.conversation.create({
        data: {
          workspaceId: WORKSPACE_ID,
          contactId: contact!.id,
          productSource: "MCTB",
          missedCallEventId: eventId,
          status: "OPEN",
        },
      })).id,
      direction: "outbound",
      body,
      providerMessageId: result.providerMessageId,
      fromE164: HP_CERTIFIED_SMS_E164,
    },
  }).catch((e) => console.warn("message row:", e));
  await prisma.missedCallEvent.update({
    where: { id: eventId },
    data: {
      status: "SENT",
      eligible: true,
      smsSentAt: new Date(),
      suppressionReason: null,
    },
  });
}

main();
