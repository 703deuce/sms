import { getPrisma } from "../src/lib/db";
import { resolveMctbTexmlIngressConfig, warmMctbTexmlIngressCache } from "../src/lib/mctb/texml-ingress/config-cache";
import {
  warmMctbInboundRoutingProfileForE164,
  peekMctbInboundRoutingProfileByE164,
} from "../src/lib/mctb/texml-ingress/routing-profile";
import { resolveBestMctbIngressPhoneRow } from "../src/lib/mctb/texml-ingress/resolve-phone-row";

const E164 = process.env.PHONE_E164 || "+15717491060";

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({ where: { e164: E164 } });
  console.log("phone row:", JSON.stringify(phone, null, 2));

  const best = await resolveBestMctbIngressPhoneRow(E164);
  console.log("\nbest ingress row:", JSON.stringify(best, null, 2));

  const config = await resolveMctbTexmlIngressConfig(E164);
  console.log("\ningress config:", JSON.stringify(config, null, 2));

  await warmMctbTexmlIngressCache(E164);
  const warmed = await warmMctbInboundRoutingProfileForE164(E164);
  console.log("\nwarmed profile:", JSON.stringify(warmed, null, 2));
  console.log("\npeek profile:", JSON.stringify(peekMctbInboundRoutingProfileByE164(E164), null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
