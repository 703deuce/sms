#!/usr/bin/env npx tsx
/**
 * Roll Telnyx primary FQDN back to LiveKit Cloud SIP (emergency restore).
 *
 * Usage:
 *   npx tsx scripts/rollback-telnyx-fqdn-to-cloud.ts
 *   npx tsx scripts/rollback-telnyx-fqdn-to-cloud.ts --apply
 */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_571_SIP_FQDN_CONNECTION_ID } from "@/lib/mctb/sip-diagnostic/constants";

const apply = process.argv.includes("--apply");
const cloudSipHost =
  process.env.LIVEKIT_CLOUD_SIP_URI?.replace(/^["']|["']$/g, "") ||
  process.env.LIVEKIT_CLOUD_SIP_HOST?.replace(/^["']|["']$/g, "") ||
  "sms-6w01zoya.sip.livekit.cloud"; // pragma: allowlist secret

async function main() {
  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": MCTB_571_SIP_FQDN_CONNECTION_ID, "page[size]": 20 },
  });
  const target = (fqdns.data || []).find(
    (r) => String(r.fqdn || "").toLowerCase() === cloudSipHost.toLowerCase(),
  );
  if (!target?.id) {
    throw new Error(`Cloud FQDN record not found for ${cloudSipHost}`);
  }

  const conn = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(MCTB_571_SIP_FQDN_CONNECTION_ID)}`,
  );
  const primaryId = String(
    (conn.data?.inbound as Record<string, unknown> | undefined)?.default_primary_fqdn_id || "",
  );

  console.log(
    JSON.stringify(
      {
        apply,
        connectionId: MCTB_571_SIP_FQDN_CONNECTION_ID,
        currentPrimaryId: primaryId,
        cloudFqdn: cloudSipHost,
        cloudFqdnId: target.id,
      },
      null,
      2,
    ),
  );

  if (primaryId === String(target.id)) {
    console.log("\nAlready pointing at cloud FQDN.");
    return;
  }

  if (!apply) {
    console.log("\nDry run — pass --apply to set primary FQDN to cloud.");
    return;
  }

  await telnyxRequest(`/fqdn_connections/${encodeURIComponent(MCTB_571_SIP_FQDN_CONNECTION_ID)}`, {
    method: "PATCH",
    body: {
      inbound: {
        default_primary_fqdn_id: target.id,
      },
    },
  });

  console.log(`\nRolled back primary FQDN to ${cloudSipHost}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
