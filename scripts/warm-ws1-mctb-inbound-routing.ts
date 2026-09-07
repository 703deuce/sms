/**
 * Warm ws_1 MCTB inbound routing profiles (571 + active MCTB DIDs).
 * Run after deploy or setup: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/warm-ws1-mctb-inbound-routing.ts
 */
import { warmMctbInboundRoutingProfileForWorkspace } from "../src/lib/mctb/texml-ingress/routing-profile";
import { peekMctbInboundRoutingProfileByE164 } from "../src/lib/mctb/texml-ingress/routing-profile";

const WS = process.env.WORKSPACE_ID || "ws_1";
const ACTIVE_E164 = process.env.PHONE_E164 || "+18663464256";

async function main() {
  await warmMctbInboundRoutingProfileForWorkspace(WS);
  const profile = peekMctbInboundRoutingProfileByE164(ACTIVE_E164);
  console.log(
    JSON.stringify(
      {
        ok: Boolean(profile),
        workspaceId: WS,
        activeE164: ACTIVE_E164,
        profile: profile
          ? {
              e164: profile.e164,
              routingToken: profile.routingToken,
              consentMode: profile.consentMode,
              automationActive: profile.automationActive,
              press1PlayUrl: profile.press1PlayUrl,
              voicemail: profile.voicemail,
              warmedAt: profile.warmedAt,
            }
          : null,
      },
      null,
      2,
    ),
  );
  if (!profile) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
