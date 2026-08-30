/**
 * Switch +18663464256 from Amy (AI TeXML) → MCTB TeXML ingress.
 * Does NOT modify the Amy agent draft/publish config.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/switch-866-amy-to-mctb-texml.ts
 *
 * Certification (set before calling):
 *   MCTB_TEXML_CERT_MODE=A|B|C|D
 */
import { getPrisma } from "../src/lib/db";
import { switchDidToMctbTexmlIngress } from "../src/lib/mctb/texml-ingress/provision";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { resolveMctbTexmlCertMode } from "../src/lib/mctb/texml-ingress/cert-mode";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";
const E164 = process.env.PHONE_E164 || "+18663464256";

async function main() {
  const prisma = getPrisma();
  const amy = await prisma.voiceAgent.findFirst({
    where: { id: AMY_AGENT_ID, workspaceId: WORKSPACE_ID },
    select: { id: true, name: true, phoneNumberId: true, telnyxAssistantId: true, status: true },
  });

  console.log("=== Before switch ===");
  console.log(JSON.stringify({ amy, certMode: resolveMctbTexmlCertMode() }, null, 2));

  const result = await switchDidToMctbTexmlIngress({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
    unassignAgentId: AMY_AGENT_ID,
    friendlyName: `MCTB TeXML ${E164}`,
  });

  const listed = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>(
    "/phone_numbers",
    { query: { "filter[phone_number]": E164 } },
  );
  const pn = listed.data?.[0];

  console.log("\n=== After switch ===");
  console.log(
    JSON.stringify(
      {
        ...result,
        telnyxNumber: {
          connection_id: pn?.connection_id,
          connection_name: pn?.connection_name,
        },
        amyAfter: await prisma.voiceAgent.findFirst({
          where: { id: AMY_AGENT_ID },
          select: { phoneNumberId: true, status: true, telnyxAssistantId: true },
        }),
      },
      null,
      2,
    ),
  );

  if (!result.ok) process.exit(1);
  console.log(`\nREADY — conditional-forward to ${E164} (MCTB TeXML, cert ${resolveMctbTexmlCertMode()})`);
  console.log("Amy agent unchanged; only DID routing moved off AI.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
