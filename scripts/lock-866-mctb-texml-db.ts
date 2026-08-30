/**
 * Lock 866 on MCTB TeXML in DB (prevents LiveKit/after-hours steal on reprovision).
 */
import { getPrisma } from "../src/lib/db";
import { mergePhoneCapabilitySettings } from "../src/lib/numbers/phone-capabilities";
import { MCTB_TEXML_ROUTING_MODE, MCTB_TEXML_ROUTING_OWNER } from "../src/lib/mctb/texml-ingress/constants";
import { scrubCompetingIngressTelephonyFields } from "../src/lib/mctb/voice-ingress-guard";
import { invalidateMctbTexmlIngressCache } from "../src/lib/mctb/texml-ingress/config-cache";

const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findUnique({ where: { id: PHONE_866_ID } });
  if (!phone) throw new Error("866 not found");

  const settings = mergePhoneCapabilitySettings(phone.settingsJson, {
    mctbEnabled: true,
    voiceEnabled: true,
    aiAfterHoursEnabled: false,
  });
  const telephony =
    settings.telephony && typeof settings.telephony === "object"
      ? { ...(settings.telephony as Record<string, unknown>) }
      : {};
  telephony.routingMode = MCTB_TEXML_ROUTING_MODE;
  telephony.routingOwner = MCTB_TEXML_ROUTING_OWNER;
  telephony.state = "active";
  telephony.lastError = null;
  settings.telephony = scrubCompetingIngressTelephonyFields(telephony);
  settings.routingOwner = MCTB_TEXML_ROUTING_OWNER;
  settings.mctbRole = "customer_mctb";

  await prisma.phoneNumber.update({
    where: { id: PHONE_866_ID },
    data: { settingsJson: settings },
  });
  invalidateMctbTexmlIngressCache(phone.e164);

  console.log(
    JSON.stringify(
      {
        ok: true,
        e164: phone.e164,
        routingMode: telephony.routingMode,
        aiAfterHoursEnabled: settings.capabilities?.aiAfterHoursEnabled,
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
