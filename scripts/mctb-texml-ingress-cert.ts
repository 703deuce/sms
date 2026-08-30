/**
 * Verify MCTB TeXML ingress routing for a DID (fail fast on wrong connection).
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-texml-ingress-cert.ts
 */
import { getPrisma } from "../src/lib/db";
import { verifyMctbTexmlIngressRoute } from "../src/lib/mctb/texml-ingress/texml-route";
import { resolveMctbTexmlIngressConfig } from "../src/lib/mctb/texml-ingress/config-cache";
import { loadMctbConsentMode } from "../src/lib/mctb/consent-prompt/service";

const PHONE_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";

async function main() {
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: PHONE_ID, workspaceId: WORKSPACE_ID },
  });
  if (!phone?.e164 || !phone.providerNumberId) {
    throw new Error("Phone not found");
  }

  const verify = await verifyMctbTexmlIngressRoute({
    e164: phone.e164,
    providerNumberId: phone.providerNumberId,
  });
  const config = await resolveMctbTexmlIngressConfig(phone.e164);
  const consentMode = await loadMctbConsentMode(WORKSPACE_ID);

  const report = {
    e164: phone.e164,
    verify,
    config,
    consentMode,
    certMode: process.env.MCTB_TEXML_CERT_MODE || "D",
    pass: verify.ok && config?.routingMode === "mctb_texml",
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
