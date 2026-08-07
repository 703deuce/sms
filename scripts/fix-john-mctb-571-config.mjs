#!/usr/bin/env node
/**
 * Point John MCTB at the 571 DID (voice trigger + SMS sender).
 * The 866 toll-free is voice-only and cannot send SMS.
 *
 *   npx tsx scripts/fix-john-mctb-571-config.mjs
 */
import { PrismaClient } from "@prisma/client";

const WORKSPACE_ID = (process.env.WORKSPACE_ID || "ws_1").trim();
const PHONE_571_ID = (process.env.PHONE_NUMBER_ID || "cmsgtjms84g6l2h0o255w1e3v").trim();
const TEST_CALLER = "+15714776175";

async function main() {
  const prisma = new PrismaClient();
  const { activateJohnOnPhoneNumber } = await import(
    "../src/lib/agents/missed-call-text-back/phone-switch.ts"
  );

  const pn = await prisma.phoneNumber.findUnique({ where: { id: PHONE_571_ID } });
  if (!pn) throw new Error(`571 number ${PHONE_571_ID} not found`);

  const result = await activateJohnOnPhoneNumber({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_571_ID,
    smsPhoneNumberId: PHONE_571_ID,
    delaySeconds: 0,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        workspaceId: WORKSPACE_ID,
        callThisNumber: pn.e164,
        smsFrom: pn.e164,
        expectSmsTo: TEST_CALLER,
        note: "John texts the caller's phone (ANI), not a fixed destination.",
        config: result.config,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
