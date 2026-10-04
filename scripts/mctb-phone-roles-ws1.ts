#!/usr/bin/env npx tsx
import Module from "node:module";
const o = (Module as unknown as { _load: Function })._load;
(Module as unknown as { _load: Function })._load = function (r, p, m) {
  if (r === "server-only") return {};
  return o(r, p, m);
};

async function main() {
  const { getPrisma } = await import("../src/lib/db");
  const { parseMctbPhoneRole } = await import("../src/lib/messaging/compliance/phone-number-class");
  const { isMctbTexmlVoiceIngress } = await import("../src/lib/mctb/sip-ingress/sync");
  const prisma = getPrisma();

  const nums = await prisma.phoneNumber.findMany({
    where: {
      OR: [{ e164: { contains: "8666020680" } }, { e164: { contains: "5714776175" } }, { e164: { contains: "5714073615" } }],
    },
    select: { id: true, workspaceId: true, e164: true, settingsJson: true },
  });
  for (const n of nums) {
    console.log({
      e164: n.e164,
      ws: n.workspaceId,
      mctbRole: parseMctbPhoneRole(n.settingsJson),
      texmlIngress: isMctbTexmlVoiceIngress(n.settingsJson),
      settings: n.settingsJson,
    });
  }

  const configs = await prisma.missedCallTextConfig.findMany({
    select: { workspaceId: true, phoneNumberId: true, businessNumberE164: true, senderPhoneNumberId: true },
  });
  console.log("\nmissedCallTextConfig rows:", configs.length);
  for (const c of configs.slice(0, 15)) {
    const phone = await prisma.phoneNumber.findUnique({ where: { id: c.phoneNumberId }, select: { e164: true } });
    const sender = c.senderPhoneNumberId
      ? await prisma.phoneNumber.findUnique({ where: { id: c.senderPhoneNumberId }, select: { e164: true } })
      : null;
    console.log({
      ws: c.workspaceId,
      ingressPhone: phone?.e164,
      business: c.businessNumberE164,
      sender: sender?.e164,
    });
  }
}

main();
