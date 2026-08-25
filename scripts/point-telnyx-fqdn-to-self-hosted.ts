#!/usr/bin/env npx tsx
/**
 * Point Telnyx primary FQDN at self-hosted LiveKit SIP (voice.transovo.ai).
 * Inverse of scripts/rollback-telnyx-fqdn-to-cloud.ts.
 *
 * Usage:
 *   npx tsx scripts/point-telnyx-fqdn-to-self-hosted.ts
 *   npx tsx scripts/point-telnyx-fqdn-to-self-hosted.ts --apply
 */
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { MCTB_571_SIP_FQDN_CONNECTION_ID } from "@/lib/mctb/sip-diagnostic/constants";
import { LIVEKIT_SELF_HOSTED_SIP_HOST } from "@/lib/voice/media-backend/constants";

const apply = process.argv.includes("--apply");
const selfHostedSipHost = LIVEKIT_SELF_HOSTED_SIP_HOST;

async function main() {
  const fqdns = await telnyxRequest<{ data?: Array<Record<string, unknown>> }>("/fqdns", {
    query: { "filter[connection_id]": MCTB_571_SIP_FQDN_CONNECTION_ID, "page[size]": 20 },
  });
  const rows = fqdns.data || [];
  const target = rows.find(
    (r) => String(r.fqdn || "").toLowerCase() === selfHostedSipHost.toLowerCase(),
  );

  const conn = await telnyxRequest<{ data?: Record<string, unknown> }>(
    `/fqdn_connections/${encodeURIComponent(MCTB_571_SIP_FQDN_CONNECTION_ID)}`,
  );
  const primaryId = String(
    (conn.data?.inbound as Record<string, unknown> | undefined)?.default_primary_fqdn_id || "",
  );
  const currentPrimary = rows.find((r) => String(r.id) === primaryId);

  console.log(
    JSON.stringify(
      {
        apply,
        connectionId: MCTB_571_SIP_FQDN_CONNECTION_ID,
        targetSelfHostedFqdn: selfHostedSipHost,
        targetFqdnId: target?.id ?? null,
        currentPrimaryFqdn: currentPrimary?.fqdn ?? null,
        currentPrimaryId: primaryId || null,
        allFqdns: rows.map((r) => ({
          id: r.id,
          fqdn: r.fqdn,
          primary: String(r.id) === primaryId,
        })),
      },
      null,
      2,
    ),
  );

  if (!target?.id) {
    throw new Error(
      `Self-hosted FQDN record not found for ${selfHostedSipHost}. Run switch-active-media-backend-ingress with MEDIA_BACKEND_MODE=self_hosted first.`,
    );
  }

  if (primaryId === String(target.id)) {
    console.log("\nAlready pointing at self-hosted FQDN.");
    return;
  }

  if (!apply) {
    console.log("\nDry run — pass --apply to set primary FQDN to self-hosted.");
    return;
  }

  await telnyxRequest(`/fqdn_connections/${encodeURIComponent(MCTB_571_SIP_FQDN_CONNECTION_ID)}`, {
    method: "PATCH",
    body: {
      inbound: {
        default_primary_fqdn_id: target.id,
        default_secondary_fqdn_id: null,
        default_tertiary_fqdn_id: null,
      },
    },
  });

  console.log(`\nPrimary FQDN set to ${selfHostedSipHost}`);
  console.log(
    "Next: confirm Coolify transovo-web + transovo-voice have MEDIA_BACKEND_MODE=self_hosted, then redeploy transovo-voice.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
