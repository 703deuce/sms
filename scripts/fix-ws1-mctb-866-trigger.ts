/**
 * Point ws_1 MCTB voice trigger at 866; keep SMS on 571 (866 is voice-only).
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/fix-ws1-mctb-866-trigger.ts
 */
import { getPrisma } from "../src/lib/db";
import { updateMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const PHONE_571_ID = process.env.PHONE_571_ID || "cmsgtjms84g6l2h0o255w1e3v";

async function main() {
  const prisma = getPrisma();
  const before = await loadMissedCallTextConfig(WORKSPACE_ID);

  const phone866 = await prisma.phoneNumber.findUnique({ where: { id: PHONE_866_ID } });
  const phone571 = await prisma.phoneNumber.findUnique({ where: { id: PHONE_571_ID } });
  if (!phone866) throw new Error(`866 phone ${PHONE_866_ID} not found`);
  if (!phone571) throw new Error(`571 SMS phone ${PHONE_571_ID} not found`);

  await updateMissedCallTextConfig({
    workspaceId: WORKSPACE_ID,
    patch: {
      enabled: true,
      phone_number_id: PHONE_866_ID,
      sms_phone_number_id: PHONE_571_ID,
    },
    source: "mctb_866_texml_cert",
  });

  const after = await loadMissedCallTextConfig(WORKSPACE_ID);

  console.log(
    JSON.stringify(
      {
        ok: true,
        workspaceId: WORKSPACE_ID,
        voiceTrigger: { id: phone866.id, e164: phone866.e164 },
        smsSender: { id: phone571.id, e164: phone571.e164 },
        before: {
          phoneNumberId: before.phoneNumberId,
          smsPhoneNumberId: before.smsPhoneNumberId,
        },
        after: {
          phoneNumberId: after.phoneNumberId,
          smsPhoneNumberId: after.smsPhoneNumberId,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
