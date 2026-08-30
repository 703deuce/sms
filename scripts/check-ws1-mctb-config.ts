import { getPrisma } from "../src/lib/db";
import { loadMissedCallTextConfig } from "../src/lib/agents/missed-call-text-back/config";
import { loadMctbConsentMode } from "../src/lib/mctb/consent-prompt/service";
import { getMctbEntitlement } from "../src/lib/mctb/entitlement";

const WS = "ws_1";
const PHONE_866 = "cmsc3numa1j17084g391t2z5l";

async function main() {
  const prisma = getPrisma();
  const config = await loadMissedCallTextConfig(WS);
  const consentMode = await loadMctbConsentMode(WS);
  const entitlement = await getMctbEntitlement(WS);
  const phone = await prisma.phoneNumber.findUnique({ where: { id: PHONE_866 } });

  console.log(
    JSON.stringify(
      {
        consentMode,
        entitlement,
        mctbConfig: {
          enabled: config.enabled,
          phoneNumberId: config.phoneNumberId,
          smsPhoneNumberId: config.smsPhoneNumberId,
          requireCarrierForward: config.requireCarrierForward,
          delaySeconds: config.delaySeconds,
        },
        phone866: phone ? { id: phone.id, e164: phone.e164 } : null,
        phoneNumberIdMatch: config.phoneNumberId === PHONE_866,
        triggerDisabledWouldFire:
          Boolean(config.phoneNumberId && config.phoneNumberId !== PHONE_866),
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
