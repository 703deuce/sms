/**
 * Point Telnyx MCTB TeXML voice_url at local dev via cloudflared tunnel for one live CFNA test.
 * Restores previous voice_url on exit (Ctrl+C or after --wait-sec).
 *
 *   # terminal 1: dev server
 *   npm run dev
 *
 *   # terminal 2: tunnel
 *   /tmp/cloudflared tunnel --url http://localhost:3000
 *
 *   # terminal 3: arm dev CFNA probe + repoint Telnyx
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/dev-cfna-live-tunnel.ts \
 *     --tunnel https://YOUR.trycloudflare.com --wait-sec 600
 */
import { getPrisma } from "../src/lib/db";
import { telnyxRequest } from "../src/lib/messaging/telnyx/client";
import { preflightTexmlVoiceUrl } from "../src/lib/mctb/texml-ingress/preflight";

const TEXML_APP_ID = process.env.MCTB_TEXML_APP_ID?.trim() || "3037587396909598261";

const args = process.argv.slice(2);
function argValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const tunnelBase = (argValue("--tunnel") || process.env.DEV_CFNA_TUNNEL_URL || "").replace(/\/$/, "");
const waitSec = Number(argValue("--wait-sec") || process.env.DEV_CFNA_WAIT_SEC || "600");
const watchE164 = argValue("--e164") || "+15717491060";

if (!tunnelBase) {
  console.error("Usage: --tunnel https://xxxx.trycloudflare.com");
  process.exit(1);
}

const devVoiceUrl = `${tunnelBase}/api/telnyx/voice/mctb-entry?cert=C3`;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function pollForLiveEntry(since: Date): Promise<void> {
  const prisma = getPrisma();
  const digits = watchE164.replace(/\D/g, "").slice(-10);
  for (let i = 0; i < waitSec; i += 2) {
    const rows = await prisma.cfnaIngressProbe.findMany({
      where: { layer: "mctb-entry", recordedAt: { gte: since } },
      orderBy: { recordedAt: "desc" },
      take: 5,
    });
    const hit = rows.find((r) =>
      String(r.calledDid || "").replace(/\D/g, "").endsWith(digits),
    );
    if (hit) {
      console.log("\n=== LIVE mctb-entry row ===");
      console.log(JSON.stringify(hit, null, 2));
      if (hit.mctbEntryInvoked && hit.texmlGenerated) {
        console.log("\n✓ LIVE CFNA reached dev mctb-entry and returned TeXML.");
      }
      return;
    }
    if (i % 20 === 0) {
      console.log(`… waiting for live CFNA on ${watchE164} (${i}s)`);
    }
    await sleep(2000);
  }
  console.log("\nNo live mctb-entry row yet — Telnyx may not have hit the tunnel voice_url.");
}

async function main() {
  const app = await telnyxRequest<{ data?: { voice_url?: string } }>(
    `/texml_applications/${encodeURIComponent(TEXML_APP_ID)}`,
  );
  const previousVoiceUrl = String(app.data?.voice_url || "");

  const pre = await preflightTexmlVoiceUrl(devVoiceUrl);
  console.log(JSON.stringify({ devVoiceUrl, preflight: pre }, null, 2));
  if (!pre.ok) throw new Error(`Tunnel preflight failed: ${pre.error}`);

  const since = new Date();
  await telnyxRequest(`/texml_applications/${encodeURIComponent(TEXML_APP_ID)}`, {
    method: "PATCH",
    body: { voice_url: devVoiceUrl, voice_method: "POST", active: true },
  });

  console.log("\n════════════════════════════════════════════════════════");
  console.log("Telnyx voice_url → DEV TUNNEL (cert=C3)");
  console.log(devVoiceUrl);
  console.log(`\nPlace ONE AT&T CFNA test call to ${watchE164} now.`);
  console.log(`Watching cfna_ingress_probes for ${waitSec}s…`);
  console.log("════════════════════════════════════════════════════════\n");

  const restore = async () => {
    if (!previousVoiceUrl) return;
    console.log("\nRestoring Telnyx voice_url →", previousVoiceUrl);
    await telnyxRequest(`/texml_applications/${encodeURIComponent(TEXML_APP_ID)}`, {
      method: "PATCH",
      body: { voice_url: previousVoiceUrl, voice_method: "POST", active: true },
    });
  };

  process.on("SIGINT", () => {
    void restore().finally(() => process.exit(0));
  });
  process.on("SIGTERM", () => {
    void restore().finally(() => process.exit(0));
  });

  try {
    await pollForLiveEntry(since);
  } finally {
    await restore();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
